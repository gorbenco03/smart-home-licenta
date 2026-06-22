/*
 * Test FINAL combinat — buzzer + PIR + ventilator (releu) + 2 fotorezistori.
 * Serial Monitor la 115200.
 *
 * ---- CONECTARE ----
 * Buzzer (activ, 2 pini):
 *   (+) -> GPIO13 ,  (-) -> GND
 *
 * PIR (HC-SR501, 3 pini):
 *   VCC -> 5V ,  OUT -> GPIO14 ,  GND -> GND
 *   (iesirea PIR e 3.3V => sigur pentru ESP32)
 *
 * Ventilator prin modul releu (HIGH trigger):
 *   Releu:  VCC -> 5V , GND -> GND , IN -> GPIO19
 *   Ventilator: 5V -> COM , NO -> (+)ventilator , (-)ventilator -> GND
 *
 * 2x Fotorezistor (LDR) cu divizor:
 *   LDR1: 3V3 --[LDR]--+--[10k]--GND , nodul --> GPIO35
 *   LDR2: 3V3 --[LDR]--+--[10k]--GND , nodul --> GPIO36 (VP)
 *
 * Comportament test:
 *   - citeste continuu cei 2 LDR (lumina)
 *   - cand PIR detecteaza miscare: porneste ventilatorul 2s + buzzer scurt
 *   - la fiecare 10s face un beep de "viata" ca sa stii ca merge
 */

#define BUZZER_PIN  13
#define PIR_PIN     14
#define FAN_PIN     19
#define LDR1_PIN    35
#define LDR2_PIN    36   // VP

unsigned long lastBeep = 0;

void beep(int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  analogReadResolution(10);          // 0-1023

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, LOW);         // ventilator oprit
  pinMode(PIR_PIN, INPUT);

  Serial.println("[Test FINAL] Start — PIR are nevoie ~30-60s sa se calibreze. Stai nemiscat.");
}

void loop() {
  int ldr1 = analogRead(LDR1_PIN);
  int ldr2 = analogRead(LDR2_PIN);
  int pir  = digitalRead(PIR_PIN);

  Serial.printf("LDR1: %4d | LDR2: %4d | PIR: %s\n",
                ldr1, ldr2, pir ? ">>> MISCARE" : "linistit");

  if (pir == HIGH) {
    Serial.println("   -> Pornesc ventilatorul 2s + buzzer");
    digitalWrite(FAN_PIN, HIGH);
    beep(120);
    delay(2000);
    digitalWrite(FAN_PIN, LOW);
  }

  // beep de "viata" la 10s
  if (millis() - lastBeep > 10000) {
    beep(40);
    lastBeep = millis();
  }

  delay(500);
}
