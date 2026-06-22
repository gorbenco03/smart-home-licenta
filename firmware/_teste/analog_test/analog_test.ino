/*
 * Test senzori analogici — MQ2 (gaz) + 2 fotorezistoare (LDR).
 * Citește la 1s și afișează valorile ADC (0–1023) în Serial Monitor (115200).
 *
 * Conectare (toate pe ADC1, intrari-only):
 *   MQ2  AO --[10k]--+--[10k]--GND ,  nodul --> D34   (divizor 1/2, AO max 5V)
 *   LDR1: 3V3 --[LDR]--+--[10k]--GND , nodul --> D35
 *   LDR2: 3V3 --[LDR]--+--[10k]--GND , nodul --> VP (GPIO36)
 *
 * Observatii:
 *   - lumina mai multa -> LDR valoare mai mare (sau invers, depinde de cablare)
 *   - apropie o sursa de gaz/bricheta (gaz nears, NEAPRINS) -> MQ2 creste
 */

#define MQ2_PIN   34
#define LDR1_PIN  35
#define LDR2_PIN  36   // VP

void setup() {
  Serial.begin(115200);
  delay(300);
  analogReadResolution(10);   // 0–1023, ca in firmware-ul de proiect
  Serial.println("[Test analogic] Start");
}

void loop() {
  int gas   = analogRead(MQ2_PIN);
  int ldr1  = analogRead(LDR1_PIN);
  int ldr2  = analogRead(LDR2_PIN);

  Serial.printf("MQ2(gaz): %4d  |  LDR1: %4d  |  LDR2: %4d\n", gas, ldr1, ldr2);
  delay(1000);
}
