/*
 * ระบบติดตามอุณหภูมิและความชื้น — เฟิร์มแวร์สำหรับ ESP32 + DHT11
 *
 * หน้าที่ของบอร์ด: อ่านค่าจากเซนเซอร์ตามรอบเวลา แล้วส่งขึ้นเซิร์ฟเวอร์
 * ตรรกะการแจ้งเตือนทั้งหมดอยู่ฝั่งเซิร์ฟเวอร์ ไม่ได้อยู่ในบอร์ด เพราะ
 *   1. ครูแก้เกณฑ์ในหน้าเว็บได้ทันที ไม่ต้องเดินไปแฟลชบอร์ดใหม่
 *   2. บอร์ดที่ค้างหรือไฟดับจะเงียบไปเฉย ๆ — ต้องมีฝั่งเซิร์ฟเวอร์คอยจับว่า "ไม่มีข้อมูลเข้ามา"
 *
 * ไลบรารีที่ต้องติดตั้งใน Arduino IDE (Library Manager):
 *   - DHT sensor library (Adafruit)
 *   - Adafruit Unified Sensor
 * บอร์ด: esp32 by Espressif Systems  →  เลือก "ESP32 Dev Module"
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <time.h>

#include "config.h"

DHT dht(DHT_PIN, DHT_TYPE);

struct Sample {
  time_t ts;
  float temperature;
  float humidity;
  float heatIndex;
  int rssi;
};

// บัฟเฟอร์วงแหวน: เน็ตหลุดแล้วค่าที่วัดได้ไม่หาย พอต่อกลับได้จะส่งย้อนหลังทั้งชุด
static Sample buffer[BUFFER_SIZE];
static int bufferHead = 0;
static int bufferCount = 0;

static uint32_t sampleIntervalS = SAMPLE_INTERVAL_S;
static uint32_t lastSampleMs = 0;
static uint32_t lastSuccessMs = 0;

// ไม่ได้ส่งข้อมูลสำเร็จนานเกินเท่านี้ = บอร์ดน่าจะค้าง รีบูตตัวเองหนึ่งครั้ง
static const uint32_t REBOOT_AFTER_MS = 30UL * 60UL * 1000UL;

// ---------------------------------------------------------------------------
// ไฟสถานะ: กะพริบสั้น = ปกติ, กะพริบถี่ = ต่อเน็ตไม่ได้, ค้างสว่าง = เซนเซอร์อ่านไม่ได้
// ---------------------------------------------------------------------------
void blink(int times, int onMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(onMs);
  }
}

// ---------------------------------------------------------------------------
// Wi-Fi + นาฬิกา
// ---------------------------------------------------------------------------
bool connectWiFi(uint32_t timeoutMs) {
  if (WiFi.status() == WL_CONNECTED) return true;

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // ปิดโหมดประหยัดไฟ ลดอาการ latency กระตุกตอนส่งข้อมูล
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    blink(1, 100);
  }
  return WiFi.status() == WL_CONNECTED;
}

// ต้องมีเวลาจริงก่อน ไม่งั้นค่าที่ค้างในบัฟเฟอร์จะไม่รู้ว่าวัดตอนไหน
// (ใช้ UTC ล้วน — ฝั่งเว็บค่อยแปลงเป็นเวลาไทยตอนแสดงผล)
bool syncClock(uint32_t timeoutMs) {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  uint32_t start = millis();
  while (time(nullptr) < 1700000000 && millis() - start < timeoutMs) {
    delay(200);
  }
  return time(nullptr) >= 1700000000;
}

String isoTime(time_t ts) {
  struct tm t;
  gmtime_r(&ts, &t);
  char out[25];
  strftime(out, sizeof(out), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(out);
}

// ---------------------------------------------------------------------------
// อ่านเซนเซอร์
// ---------------------------------------------------------------------------
bool readSensor(Sample &out) {
  // DHT11 อ่านพลาดเป็นครั้งคราวเป็นเรื่องปกติ ลองซ้ำก่อนจะยอมแพ้
  for (int attempt = 0; attempt < 3; attempt++) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    // เฟรมที่เป็นศูนย์ล้วนมีค่า checksum เท่ากับศูนย์พอดี ไลบรารีจึงตรวจผ่าน
    // แล้วคืนค่า 0.0 °C / 0.0 %RH กลับมาเหมือนเป็นค่าที่อ่านได้จริง
    // ความชื้น 0% ไม่มีทางเกิดขึ้นในสภาพแวดล้อมจริง ถือเป็นการอ่านพลาดแล้วลองใหม่
    // (ถ้าไม่ดักไว้ บอร์ดที่รีบูตติดกันจะส่งค่า 0 ซ้ำจนระบบเตือนว่าอุณหภูมิต่ำผิดปกติ)
    if (h == 0.0f && t == 0.0f) {
      delay(2200);
      continue;
    }

    if (!isnan(h) && !isnan(t)) {
      out.ts = time(nullptr);
      out.temperature = t;
      out.humidity = h;
      out.heatIndex = dht.computeHeatIndex(t, h, false);
      out.rssi = WiFi.RSSI();
      return true;
    }
    delay(2200);  // DHT11 ต้องเว้นอย่างน้อย 2 วินาทีระหว่างการอ่าน
  }
  return false;
}

void pushBuffer(const Sample &s) {
  buffer[bufferHead] = s;
  bufferHead = (bufferHead + 1) % BUFFER_SIZE;
  if (bufferCount < BUFFER_SIZE) bufferCount++;
}

// ---------------------------------------------------------------------------
// ส่งขึ้นเซิร์ฟเวอร์
// ---------------------------------------------------------------------------
String buildPayload() {
  String json = "{\"readings\":[";
  int start = (bufferHead - bufferCount + BUFFER_SIZE) % BUFFER_SIZE;

  for (int i = 0; i < bufferCount; i++) {
    const Sample &s = buffer[(start + i) % BUFFER_SIZE];
    if (i > 0) json += ",";
    json += "{\"recorded_at\":\"" + isoTime(s.ts) + "\"";
    json += ",\"temperature_c\":" + String(s.temperature, 1);
    json += ",\"humidity_pct\":" + String(s.humidity, 1);
    json += ",\"heat_index_c\":" + String(s.heatIndex, 1);
    json += ",\"rssi\":" + String(s.rssi);
    json += ",\"uptime_s\":" + String(millis() / 1000) + "}";
  }
  json += "]}";
  return json;
}

// ดึงค่า sample_interval_s ที่เซิร์ฟเวอร์ตอบกลับมา โดยไม่ต้องใช้ไลบรารี JSON
void applyServerInterval(const String &body) {
  int at = body.indexOf("\"sample_interval_s\":");
  if (at < 0) return;
  long value = body.substring(at + 20).toInt();
  if (value >= 10 && value <= 3600) sampleIntervalS = (uint32_t)value;
}

bool sendBuffer() {
  if (bufferCount == 0) return true;
  if (!connectWiFi(20000)) return false;

  WiFiClientSecure client;
  if (strlen(ROOT_CA_PEM) > 0) {
    client.setCACert(ROOT_CA_PEM);
  } else {
    // ไม่ตรวจใบรับรอง — ข้อมูลยังเข้ารหัสอยู่ แต่ปลอมเซิร์ฟเวอร์ได้ ใช้ตอนทดสอบเท่านั้น
    client.setInsecure();
  }

  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, INGEST_URL)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  int code = http.POST(buildPayload());
  String body = http.getString();
  http.end();

  if (code == 200) {
    applyServerInterval(body);
    bufferCount = 0;  // ส่งสำเร็จแล้วจึงล้างบัฟเฟอร์ ถ้าล้มเหลวข้อมูลยังอยู่ครบ
    lastSuccessMs = millis();
    return true;
  }

  // 401/403 = คีย์ผิดหรืออุปกรณ์ถูกปิด ส่งใหม่กี่รอบก็ไม่ผ่าน ทิ้งข้อมูลเพื่อไม่ให้บัฟเฟอร์ตัน
  if (code == 401 || code == 403) {
    bufferCount = 0;
  }

  Serial.printf("ส่งไม่สำเร็จ HTTP %d: %s\n", code, body.c_str());
  return false;
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  dht.begin();

  connectWiFi(30000);
  if (!syncClock(15000)) {
    Serial.println("ตั้งนาฬิกาจาก NTP ไม่สำเร็จ — เซิร์ฟเวอร์จะใช้เวลาที่รับข้อมูลแทน");
  }

  lastSuccessMs = millis();
  lastSampleMs = millis() - (uint32_t)sampleIntervalS * 1000UL;  // ให้อ่านครั้งแรกทันที
}

void loop() {
  uint32_t now = millis();

  if (now - lastSampleMs >= sampleIntervalS * 1000UL) {
    lastSampleMs = now;

    Sample s;
    if (readSensor(s)) {
      pushBuffer(s);
      Serial.printf("%.1f °C  %.1f %%RH\n", s.temperature, s.humidity);
      if (sendBuffer()) {
        blink(1, 60);
      } else {
        blink(3, 80);
      }
    } else {
      // อ่านเซนเซอร์ไม่ได้เลย = สายหลุดหรือเซนเซอร์เสีย ค้างไฟไว้ให้เห็นชัด
      Serial.println("อ่านค่าจาก DHT ไม่ได้ ตรวจสอบสายและไฟเลี้ยง");
      digitalWrite(STATUS_LED_PIN, HIGH);
    }
  }

  // กันบอร์ดค้างเงียบ ๆ: ไม่สำเร็จนานเกินกำหนดให้รีบูตตัวเอง
  if (millis() - lastSuccessMs > REBOOT_AFTER_MS) {
    Serial.println("ส่งข้อมูลไม่สำเร็จนานเกินไป กำลังรีสตาร์ท");
    delay(100);
    ESP.restart();
  }

  delay(200);
}
