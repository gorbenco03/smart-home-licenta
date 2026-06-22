/*
 * Test combinat — 2x DHT11 (temperatura/umiditate) + MQ2 (gaz).
 * Fara fotorezistoare (le testezi separat).
 * Serial Monitor la 115200.
 *
 * Conectare:
 *   DHT11 #1 (living):   +->3V3,  OUT->GPIO4,   -->GND
 *   DHT11 #2 (dormitor): +->3V3,  OUT->GPIO23,  -->GND
 *   MQ2: VCC->5V, GND->GND, AO --[10k]--+--[10k]--GND , nodul --> GPIO34
 *        (divizor 1/2 ca AO sa nu depaseasca 3.3V; DO neconectat)
 *
 * Librarie: "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor".
 */

#include <DHT.h>

#define DHT1_PIN  4      // living
#define DHT2_PIN  23     // dormitor
#define DHT_TYPE  DHT11
#define MQ2_PIN   34     // analogic (prin divizor)
#define GAS_PRAG  350    // prag orientativ alerta gaz (0-1023)

DHT dht1(DHT1_PIN, DHT_TYPE);
DHT dht2(DHT2_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  delay(300);
  analogReadResolution(10);   // 0-1023
  dht1.begin();
  dht2.begin();
  Serial.println("[Test DHT11 x2 + MQ2] Start (MQ2 are nevoie ~30s sa se incalzeasca)");
}

void citeste(DHT& dht, const char* nume) {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.printf("  %-9s: EROARE citire\n", nume);
  } else {
    Serial.printf("  %-9s: %.1f C  |  %.0f %%\n", nume, t, h);
  }
}

void loop() {
  Serial.println("----------------------------");
  citeste(dht1, "Living");
  citeste(dht2, "Dormitor");

  int gas = analogRead(MQ2_PIN);
  Serial.printf("  Gaz (MQ2): %4d %s\n", gas, gas > GAS_PRAG ? "  >>> ALERTA GAZ" : "(normal)");

  delay(2000);   // DHT11 = max ~1 citire/secunda
}
