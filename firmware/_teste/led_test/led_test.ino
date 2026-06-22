/*
 * Test cele 4 LED-uri — le aprinde pe rând, apoi toate, apoi stinge.
 * Serial Monitor la 115200 arată care LED e aprins.
 *
 * Conectare fiecare LED:  GPIO --[220Ω]--|>|-- GND
 *   picior lung (+) spre rezistor/GPIO, picior scurt (-) spre GND.
 */

const int LED_PINS[4] = { 25, 26, 33, 32 };          // living, dormitor, baie, afară
const char* LED_NUME[4] = { "Living", "Dormitor", "Baie", "Afara" };

void setup() {
  Serial.begin(115200);
  delay(300);
  for (int i = 0; i < 4; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  Serial.println("[Test LED] Start");
}

void loop() {
  // Aprinde pe rând
  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_PINS[i], HIGH);
    Serial.printf("LED %s (GPIO%d) PORNIT\n", LED_NUME[i], LED_PINS[i]);
    delay(700);
    digitalWrite(LED_PINS[i], LOW);
  }
  // Toate odată
  Serial.println("Toate PORNITE");
  for (int i = 0; i < 4; i++) digitalWrite(LED_PINS[i], HIGH);
  delay(900);
  Serial.println("Toate OPRITE");
  for (int i = 0; i < 4; i++) digitalWrite(LED_PINS[i], LOW);
  delay(900);
}
