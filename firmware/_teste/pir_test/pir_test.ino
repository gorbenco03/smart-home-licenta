/*
 * Test PIR + bec exterior + buzzer (alarma de miscare).
 * Serial Monitor la 115200.
 *
 * La MISCARE detectata de PIR:
 *   - se aprinde becul de afara (GPIO32)
 *   - suna buzzer-ul (GPIO13)
 * Cand nu mai e miscare: becul se stinge, buzzer-ul tace.
 *
 * Conectare:
 *   PIR:    VCC->5V , OUT->GPIO14 , GND->GND
 *   Bec afara: (+)->GPIO32 , (-)->GND
 *   Buzzer PASIV: (+)->GPIO13 , (-)->GND   (are nevoie de TON, nu doar HIGH)
 *
 * NOTA: PIR are nevoie de ~30-60s sa se calibreze la pornire. Stai nemiscat la inceput.
 */

#define PIR_PIN     14
#define LED_OUT_PIN 32     // becul de afara
#define BUZZER_PIN  13
#define BUZZER_FREQ 3000   // frecventa tonului de alarma (Hz)

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_OUT_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_OUT_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("[Test PIR] Calibrare ~30-60s, stai nemiscat...");
}

void loop() {
  int miscare = digitalRead(PIR_PIN);

  if (miscare == HIGH) {
    digitalWrite(LED_OUT_PIN, HIGH);
    tone(BUZZER_PIN, BUZZER_FREQ);          // ton continuu de alarma
    Serial.println(">>> MISCARE detectata — bec + alarma PORNITE");
  } else {
    digitalWrite(LED_OUT_PIN, LOW);
    noTone(BUZZER_PIN);                      // opreste tonul
    Serial.println("linistit");
  }

  delay(300);
}
