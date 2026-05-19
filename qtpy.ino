#include <Arduino_GFX_Library.h>
#include <math.h>

#define TFT_CS A2
#define TFT_DC A1
#define TFT_RST A0
#define BLACK 0x0000
#define WHITE 0xFFFF

Arduino_DataBus *bus = new Arduino_HWSPI(TFT_DC, TFT_CS);
Arduino_GFX *tft = new Arduino_ILI9341(bus, TFT_RST, 0);

int baseRadius = 10;
unsigned long noteTime = 0;
float rotation = 0;
float prevRotation = 0;
float zValue = 0;

int cx = 160;
int cy = 120;

#define NUM_SPOKES 20
#define BASE_WIDTH 0.18

float spokeNoise[NUM_SPOKES];
float prevSpokeLen[NUM_SPOKES];
float prevBaseWidth[NUM_SPOKES];

uint16_t zToColor(float z) {
  // clamp z so that 8-10 maps to the white end
  float zClamped = constrain(z, 0.0, 8.0);

  // map 0..8 to 0..1 so anything >= 8 is fully white
  float t = zClamped / 8.0;

  uint8_t r = (uint8_t)(77  + (255 - 77)  * t);
  uint8_t g = (uint8_t)(151 + (255 - 151) * t);
  uint8_t b = (uint8_t)(255 + (255 - 255) * t);

  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

void setup() {
  Serial.begin(9600);
  tft->begin(80000000);
  tft->setRotation(1);
  tft->fillScreen(BLACK);
  randomSeed(analogRead(0));

  for (int i = 0; i < NUM_SPOKES; i++) {
    spokeNoise[i] = random(-60, 60) / 10.0;
    prevSpokeLen[i] = 0;
    prevBaseWidth[i] = 0;
  }
}

void drawTriangleSpoke(int x0, int y0, float angle, float len, float baseW, uint16_t color) {
  int tx = x0 + (int)(len * cos(angle));
  int ty = y0 + (int)(len * sin(angle));

  float perpAngle = angle + M_PI / 2.0;
  float halfBase = len * baseW;

  int bx1 = x0 + (int)(halfBase * cos(perpAngle));
  int by1 = y0 + (int)(halfBase * sin(perpAngle));
  int bx2 = x0 - (int)(halfBase * cos(perpAngle));
  int by2 = y0 - (int)(halfBase * sin(perpAngle));

  tft->fillTriangle(bx1, by1, bx2, by2, tx, ty, color);
}

void eraseSpokes() {
  for (int i = 0; i < NUM_SPOKES; i++) {
    float angle = prevRotation + (2.0 * PI * i / NUM_SPOKES);
    drawTriangleSpoke(cx, cy, angle, prevSpokeLen[i] + 4, prevBaseWidth[i] + 0.02, BLACK);
  }
}

void drawSpokes() {
  int noise = random(0, 20);
  uint16_t starColor = zToColor(zValue);

  for (int i = 0; i < NUM_SPOKES; i++) {
    float angle = rotation + (2.0 * PI * i / NUM_SPOKES);
    float spokeLen = baseRadius + spokeNoise[i] * (noise / 5.0) + random(-noise/2, noise/2);
    spokeLen = constrain(spokeLen, 5, 200);

    float baseW = BASE_WIDTH + spokeNoise[i] * 0.01;
    baseW = constrain(baseW, 0.05, 0.35);

    drawTriangleSpoke(cx, cy, angle, spokeLen, baseW, starColor);

    prevSpokeLen[i] = spokeLen;
    prevBaseWidth[i] = baseW;
  }

  prevRotation = rotation;
  rotation += 0.03;
  if (rotation > 2.0 * PI) rotation -= 2.0 * PI;
}

void redraw() {
  eraseSpokes();
  drawSpokes();
}

void loop() {
  unsigned long now = millis();

  static unsigned long lastDecay = 0;
  if (now - lastDecay > 16) {
    lastDecay = now;
    if (now - noteTime > 100) {
      baseRadius = max(10, baseRadius - 40);
    }
    redraw();
  }

  if (Serial.available()) {
    String msg = Serial.readStringUntil('\n');
    msg.trim();

    if (msg.startsWith("n,")) {
      baseRadius = min(150, baseRadius + random(15, 50));
      noteTime = now;

    } else if (msg.startsWith("z,")) {
      zValue = msg.substring(2).toFloat();
    }
  }
}
