/*
 * Test jaluzele (servo SG90) — deschidere/închidere GRADUALĂ, la 5 secunde.
 * Servo-ul se mișcă lin (pas cu pas), nu dintr-o smucitură.
 * Serial Monitor la 115200 arată starea.
 *
 * Conectare servo SG90 la ESP32:
 *   maro  -> GND   (masă comună cu ESP32)
 *   roșu  -> 5V / VIN   (NU 3.3V)
 *   galben-> GPIO18  (semnal)
 *
 * Librărie: ESP32Servo (Library Manager).
 */

#include <ESP32Servo.h>

#define SERVO_PIN      18
#define UNGHI_DESCHIS   0     // lamele orizontale (intră lumina)
#define UNGHI_INCHIS   90     // lamele verticale (opac)
#define PAS_GRADE       2     // cât de mare e un pas (mai mic = mai lin)
#define PAUZA_PAS_MS   20     // pauză între pași (mai mare = mai lent)
#define PAUZA_FINAL_MS 5000   // 5 secunde între deschidere și închidere

Servo jaluzea;
int unghi = UNGHI_DESCHIS;

// Mișcare lină de la unghiul curent la unghiul țintă
void misca(int tinta) {
  int pas = (tinta > unghi) ? PAS_GRADE : -PAS_GRADE;
  while (unghi != tinta) {
    unghi += pas;
    // nu depăși ținta la ultimul pas
    if ((pas > 0 && unghi > tinta) || (pas < 0 && unghi < tinta)) unghi = tinta;
    jaluzea.write(unghi);
    delay(PAUZA_PAS_MS);
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  ESP32PWM::allocateTimer(0);
  jaluzea.setPeriodHertz(50);
  jaluzea.attach(SERVO_PIN, 500, 2400);

  jaluzea.write(UNGHI_DESCHIS);
  Serial.println("[Jaluzele] Start — DESCHIS");
}

void loop() {
  delay(PAUZA_FINAL_MS);
  Serial.println("[Jaluzele] Se inchid...");
  misca(UNGHI_INCHIS);
  Serial.println("[Jaluzele] INCHIS");

  delay(PAUZA_FINAL_MS);
  Serial.println("[Jaluzele] Se deschid...");
  misca(UNGHI_DESCHIS);
  Serial.println("[Jaluzele] DESCHIS");
}
