/*
 * Test rapid ESP32-CAM (AI-Thinker) — stream live pe IP.
 * Nu are MQTT/mDNS, doar verifică hardware-ul: deschizi IP-ul în browser.
 *
 * Arduino IDE:
 *   Board: "AI Thinker ESP32-CAM" | PSRAM: Enabled
 *   Partition Scheme: "Huge APP (3MB No OTA)" | Port: CH340
 *   Flash cu plăcuța MB (micro-USB). La "Connecting..." apasă RST pe MB.
 *
 * După upload: Serial Monitor 115200 → apasă RST → vei vedea IP-ul.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// ─── PUNE AICI WIFI-UL TĂU DE ACASĂ ─────────────────────────
const char* ssid     = "NUMELE_RETELEI_TALE";
const char* password = "PAROLA_TA_WIFI";
// ────────────────────────────────────────────────────────────

// Pini cameră — AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM   32
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM   26
#define SIOC_GPIO_NUM   27
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     21
#define Y4_GPIO_NUM     19
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

httpd_handle_t server = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* STREAM_BOUNDARY     = "\r\n--" PART_BOUNDARY "\r\n";
static const char* STREAM_PART         = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// /stream — MJPEG
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;
  char part_buf[64];
  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) { res = ESP_FAIL; }
    else {
      res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
      if (res == ESP_OK) {
        size_t hlen = snprintf(part_buf, 64, STREAM_PART, fb->len);
        res = httpd_resp_send_chunk(req, part_buf, hlen);
      }
      if (res == ESP_OK)
        res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
      esp_camera_fb_return(fb);
    }
    if (res != ESP_OK) break;
  }
  return res;
}

// / — pagină simplă cu imaginea
static esp_err_t index_handler(httpd_req_t *req) {
  const char* html =
    "<html><body style='margin:0;background:#000;text-align:center'>"
    "<img src='/stream' style='width:100%;max-width:640px'></body></html>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, html, strlen(html));
}

void startServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  httpd_uri_t index_uri  = { "/",       HTTP_GET, index_handler,  NULL };
  httpd_uri_t stream_uri = { "/stream", HTTP_GET, stream_handler, NULL };
  if (httpd_start(&server, &config) == ESP_OK) {
    httpd_register_uri_handler(server, &index_uri);
    httpd_register_uri_handler(server, &stream_uri);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href  = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;   // dacă dă eroare: schimbă în pin_sscb_sda
  config.pin_sccb_scl = SIOC_GPIO_NUM;   // dacă dă eroare: schimbă în pin_sscb_scl
  config.pin_pwdn  = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_SVGA;   // 800x600
  config.jpeg_quality = 12;
  config.fb_count     = 2;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location  = CAMERA_FB_IN_PSRAM;

  if (!psramFound()) {                    // fără PSRAM → mai mic
    config.frame_size  = FRAMESIZE_VGA;
    config.fb_count    = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[EROARE] Camera init: 0x%x — verifică alimentarea/cablul\n", err);
    return;
  }

  WiFi.begin(ssid, password);
  Serial.print("Conectare WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println();
  Serial.print("Camera gata! Deschide in browser:  http://");
  Serial.println(WiFi.localIP());

  startServer();
}

void loop() {
  delay(10000);
}
