/*
 * Test ventilator prin modul releu — comutare AUTOMATA la 4 secunde.
 * Serial Monitor la 115200.
 *
 * MODUL ACTIVE-LOW alimentat la 5V, comandat de la ESP32 (3.3V).
 * Truc: pentru "oprit" NU fortam pinul la 3.3V (nu stinge complet),
 *       ci il lasam in INPUT (liber) si pull-up-ul modulului il trage la 5V.
 *       Pentru "pornit" il punem OUTPUT LOW (0V) -> releu activat.
 *
 * Conectare:
 *   - (+) sursa 5V -> releu VCC  si  -> COM (mijloc)
 *   - (-) sursa     -> releu GND, GND ESP32, (-) ventilator   [masa comuna]
 *   - NO (terminalul "1") -> (+) ventilator
 *   - IN -> GPIO19
 */

#define FAN_PIN  19

void setFan(bool on) {
  if (on) {
    pinMode(FAN_PIN, OUTPUT);
    digitalWrite(FAN_PIN, LOW);   // 0V curat -> releu activat (active-LOW)
  } else {
    pinMode(FAN_PIN, INPUT);      // liber -> pull-up modul trage IN la 5V -> oprit COMPLET
  }
  Serial.println(on ? ">>> Ventilator PORNIT" : ">>> Ventilator OPRIT");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  setFan(false);                  // pornim OPRIT
  Serial.println("[Test ventilator] comutare automata la 4s");
}

void loop() {
  setFan(true);
  delay(4000);
  setFan(false);
  delay(4000);
}
