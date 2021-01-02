from picamera import PiCamera
from time import sleep
from datetime import datetime
import logging
from fractions import Fraction

logging.basicConfig(filename='/home/pi/IntruderAlert/piLogging.log', level=logging.INFO)

logging.info("Starting watch at ",datetime.now().strftime("%H:%M:%S"))

def todayAt (hr, min=0, sec=0, micros=0):
   now = datetime.now()
   return now.replace(hour=hr, minute=min, second=sec, microsecond=micros)  

while(True):
	timeNow = datetime.now()
		
	while(timeNow < todayAt (7) or timeNow > todayAt(23)):
		logging.info("It's still night :(")
		uniqueName = datetime.now().strftime("%d_%m_%Y_%H_%M_%S")
		logging.info(f"Capturing image{uniqueName}.png at {uniqueName}")
		camera = PiCamera(resolution=(720, 480),framerate=Fraction(1, 6),sensor_mode=3)
		camera.shutter_speed = 6000000
		camera.iso = 800
		sleep(30)
		camera.exposure_mode = 'off'
		camera.capture(f"/home/pi/IntruderAlert/Videos/image{uniqueName}.png")
		uniqueName = datetime.now().strftime("%d_%m_%Y_%H_%M_%S")
		logging.info(f"Captured image at {uniqueName}")
		sleep(60*4)
		timeNow = datetime.now()

	while(timeNow < todayAt (23)):
		logging.info("Tada! It's day time :)")
		uniqueName = datetime.now().strftime("%d_%m_%Y_%H_%M_%S")
		logging.info(f"Capturing image{uniqueName}.png at {uniqueName}")
		camera = PiCamera()
		camera.brightness = 60
		camera.capture(f"/home/pi/IntruderAlert/Videos/image{uniqueName}.png")
		uniqueName = datetime.now().strftime("%d_%m_%Y_%H_%M_%S")
		logging.info(f"Captured image at {uniqueName}")
		sleep(60*5)
		timeNow = datetime.now()

logging.info('Finished')
