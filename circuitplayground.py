import time
import math
import board
from adafruit_circuitplayground import cp
import neopixel

led = neopixel.NeoPixel(board.A1, 1, brightness=1, auto_write=False)
led[0] = (255, 255, 255)
led.show()

cp.pixels.brightness = 0.1
cp.pixels.auto_write = False

PIXEL_ANGLES = [270, 234, 198, 162, 126, 90, 54, 18, 342, 306]
cp._speaker_enable.value = True
last_pixel = None
color = (52, 61, 235)
sleep_duration = 0.115

prev_button_a = False

while True:
    # check button A
    button_a = cp.button_a
    if button_a and not prev_button_a:
        print("DEVICE:inst1")  # change per device
    prev_button_a = button_a

    x, y, z = cp.acceleration
    gravity_angle = math.degrees(math.atan2(y, -x)) % 360
    best_pixel = min(range(10), key=lambda i: abs(
        (PIXEL_ANGLES[i] - gravity_angle + 180) % 360 - 180
    ))
    cp.pixels.fill((0, 0, 0))
    cp.pixels[best_pixel] = color
    cp.pixels.show()
    print(f"{x:.2f},{y:.2f},{z:.2f},{best_pixel},{sleep_duration}")
    if best_pixel != last_pixel:
        last_pixel = best_pixel
    time.sleep(sleep_duration)
