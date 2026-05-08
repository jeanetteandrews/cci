#PINK 1201

import time
import math
import board
import supervisor
import sys
from adafruit_circuitplayground import cp

cp.pixels.brightness = 0.1
cp.pixels.auto_write = False

PIXEL_ANGLES = [270, 234, 198, 162, 126, 90, 54, 18, 342, 306]

cp._speaker_enable.value = True
last_pixel = None
color = (100, 10, 25)

sleep_duration = 0.214

while True:
    if supervisor.runtime.serial_bytes_available:
        msg = sys.stdin.readline().strip()
        try:
            val = float(msg)
            if 0.05 < val < 1.0:
                sleep_duration = val
        except ValueError:
            pass

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
