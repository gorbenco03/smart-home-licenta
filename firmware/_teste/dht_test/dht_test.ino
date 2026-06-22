/*
 * Test cele 2 senzoare DHT11 — afișează temperatura și umiditatea la 2s.
 * Serial Monitor la 115200.
 *
 * Conectare (modul cu 3 pini):
 *   +    -> 3V3
 *   OUT  -> DHT #1 = GPIO4 (living),  DHT #2 = GPIO23 (dormitor)
 *   -    -> GND
 * (DHT11 cu 4 pini: pune un rezistor 10k intre DATA si VCC.)
 *
 * Librărie: "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor".
 */

#include <DHT.h>

#define DHT1_PIN  4      // living
#define DHT2_PIN  23     // dormitor
#define DHT_TYPE  DHT11

DHT dht1(DHT1_PIN, DHT_TYPE);
DHT dht2(DHT2_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  delay(300);
  dht1.begin();
  dht2.begin();
  Serial.println("[Test DHT11] Start");
}

void citeste(DHT& dht, const char* nume) {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.printf("  %-9s: EROARE citire (verifica firele/alimentarea)\n", nume);
  } else {
    Serial.printf("  %-9s: %.1f C  |  %.0f %%\n", nume, t, h);
  }
}

void loop() {
  Serial.println("---- DHT11 ----");
  citeste(dht1, "Living");
  citeste(dht2, "Dormitor");
  delay(2000);   // DHT11 = max ~1 citire/secunda
}
