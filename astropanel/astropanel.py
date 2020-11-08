#!/usr/bin/env python3
# coding=utf-8

"""
Copyright(c) 2019 Radek Kaczorek  <rkaczorek AT gmail DOT com>

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Library General Public
License version 3 as published by the Free Software Foundation.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public License
along with this library; see the file COPYING.LIB.  If not, write to
the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
Boston, MA 02110-1301, USA.
"""

DEBUG = False

from gps3 import gps3
from gevent import monkey; monkey.patch_all()
from flask import Flask, render_template
from flask_socketio import SocketIO
import sys, os, configparser, re, ephem, numpy, datetime, time

__author__ = 'Radek Kaczorek'
__copyright__ = 'Copyright 2019, Radek Kaczorek'
__license__ = 'GPL-3'
__version__ = '2.0.0'

app = Flask(__name__, static_folder='assets')
socketio = SocketIO(app)
thread = None

class gpsTimeout(Exception):
	def __init__(self, value):
		self.value = value
	def __str__(self):
		return repr(self.value)

def get_moon_phase(observer):
	target_date_utc = observer.date
	target_date_local = ephem.localtime( target_date_utc ).date()
	next_full = ephem.localtime( ephem.next_full_moon(target_date_utc) ).date()
	next_new = ephem.localtime( ephem.next_new_moon(target_date_utc) ).date()
	next_last_quarter = ephem.localtime( ephem.next_last_quarter_moon(target_date_utc) ).date()
	next_first_quarter = ephem.localtime( ephem.next_first_quarter_moon(target_date_utc) ).date()
	previous_full = ephem.localtime( ephem.previous_full_moon(target_date_utc) ).date()
	previous_new = ephem.localtime( ephem.previous_new_moon(target_date_utc) ).date()
	previous_last_quarter = ephem.localtime( ephem.previous_last_quarter_moon(target_date_utc) ).date()
	previous_first_quarter = ephem.localtime( ephem.previous_first_quarter_moon(target_date_utc) ).date()

	if target_date_local in (next_full, previous_full):
		return 'Full'
	elif target_date_local in (next_new, previous_new):
		return 'New'
	elif target_date_local in (next_first_quarter, previous_first_quarter):
		return 'First Quarter'
	elif target_date_local in (next_last_quarter, previous_last_quarter):
		return 'Last Quarter'
	elif previous_new < next_first_quarter < next_full < next_last_quarter < next_new:
		return 'Waxing Crescent'
	elif previous_first_quarter < next_full < next_last_quarter < next_new < next_first_quarter:
		return 'Waxing Gibbous'
	elif previous_full < next_last_quarter < next_new < next_first_quarter < next_full:
		return 'Waning Gibbous'
	elif previous_last_quarter < next_new < next_first_quarter < next_full < next_last_quarter:
		return 'Waning Crescent'

def get_body_positions(observer, body):
	positions = []

	# test for always below horizon or always above horizon
	try:
		if ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and observer.previous_rising(body) < observer.previous_transit(body) < observer.previous_setting(body) < observer.date:
			positions.append(observer.previous_rising(body))
			positions.append(observer.previous_transit(body))
			positions.append(observer.previous_setting(body))
		elif ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and observer.previous_rising(body) < observer.previous_transit(body) < observer.date < observer.next_setting(body):
			positions.append(observer.previous_rising(body))
			positions.append(observer.previous_transit(body))
			positions.append(observer.next_setting(body))
		elif ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and observer.previous_rising(body) < observer.date < observer.next_transit(body) < observer.next_setting(body):
			positions.append(observer.previous_rising(body))
			positions.append(observer.next_transit(body))
			positions.append(observer.next_setting(body))
		elif ephem.localtime(observer.previous_rising(body)).date() == ephem.localtime(observer.date).date() and  observer.date < observer.next_rising(body) < observer.next_transit(body) < observer.next_setting(body):
			positions.append(observer.next_rising(body))
			positions.append(observer.next_transit(body))
			positions.append(observer.next_setting(body))
		else:
			positions.append(observer.next_rising(body))
			positions.append(observer.next_transit(body))
			positions.append(observer.next_setting(body))
	except (ephem.NeverUpError, ephem.AlwaysUpError):
		try:
			if ephem.localtime(observer.previous_transit(body)).date() == ephem.localtime(observer.date).date() and observer.previous_transit(body) < observer.date:
				positions.append('-')
				positions.append(observer.previous_transit(body))
				positions.append('-')
			elif ephem.localtime(observer.previous_transit(body)).date() == ephem.localtime(observer.date).date() and observer.next_transit(body) > observer.date:
				positions.append('-')
				positions.append(observer.next_transit(body))
				positions.append('-')
			else:
				positions.append('-')
				positions.append('-')
				positions.append('-')
		except (ephem.NeverUpError, ephem.AlwaysUpError):
			positions.append('-')
			positions.append('-')
			positions.append('-')

	if positions[0] != '-':
		positions[0] = ephem.localtime( positions[0] ).strftime("%H:%M:%S")
	if positions[1] != '-':
		positions[1] = ephem.localtime( positions[1] ).strftime("%H:%M:%S")
	if positions[2] != '-':
		positions[2] = ephem.localtime( positions[2] ).strftime("%H:%M:%S")

	return positions

def get_sun_twilights(observer):
	results = []

	"""
	An observer at the North Pole would see the Sun circle the sky at 23.5° above the horizon all day.
	An observer at 90° – 23.5° = 66.5° would see the Sun spend the whole day on the horizon, making a circle along its circumference.
	An observer would have to be at 90° – 23.5° – 18° = 48.5° latitude or even further south in order for the Sun to dip low enough for them to observe the level of darkness defined as astronomical twilight.	

	civil twilight = -6
	nautical twilight = -12
	astronomical twilight = -18

	get_sun_twilights(home)[0][0]	-	civil twilight end
	get_sun_twilights(home)[0][1]	-	civil twilight start

	get_sun_twilights(home)[1][0]	-	nautical twilight end
	get_sun_twilights(home)[1][1]	-	nautical twilight start

	get_sun_twilights(home)[2][0]	-	astronomical twilight end
	get_sun_twilights(home)[2][1]	-	astronomical twilight start
	"""

	# remember entry observer horizon
	observer_horizon = observer.horizon

	# Twilights, their horizons and whether to use the centre of the Sun or not
	twilights = [('-6', True), ('-12', True), ('-18', True)]

	for twi in twilights:
		observer.horizon = twi[0]
		try:
			rising_setting = get_body_positions(observer,ephem.Sun(observer))
			results.append((rising_setting[0], rising_setting[2]))
		except ephem.AlwaysUpError:
			results.append(('n/a', 'n/a'))

	# reset observer horizon to entry
	observer.horizon = observer_horizon

	return results

def get_polaris_data(observer):
	polaris_data = []

	"""
	lst = 100.46 + 0.985647 * d + lon + 15 * ut [based on http://www.stargazing.net/kepler/altaz.html]
	d - the days from J2000 (1200 hrs UT on Jan 1st 2000 AD), including the fraction of a day
	lon - your longitude in decimal degrees, East positive
	ut - the universal time in decimal hours
	"""

	j2000 = ephem.Date('2000/01/01 12:00:00')
	d = observer.date - j2000

	lon = numpy.rad2deg(float(repr(observer.lon)))

	utstr = observer.date.datetime().strftime("%H:%M:%S")
	ut = float(utstr.split(":")[0]) + float(utstr.split(":")[1])/60 + float(utstr.split(":")[2])/3600

	lst = 100.46 + 0.985647 * d + lon + 15 * ut
	lst = lst - int(lst / 360) * 360

	polaris = ephem.readdb("Polaris,f|M|F7,2:31:48.704,89:15:50.72,2.02,2000")
	polaris.compute()
	polaris_ra_deg = numpy.rad2deg(float(repr(polaris.ra)))

	# Polaris Hour Angle = LST - RA Polaris [expressed in degrees or 15*(h+m/60+s/3600)]
	pha = lst - polaris_ra_deg

	# normalize
	if pha < 0:
		pha += 360
	elif pha > 360:
		pha -= 360

	# append polaris hour angle
	polaris_data.append(pha)

	# append polaris next transit
	try:
		polaris_data.append(ephem.localtime( observer.next_transit(polaris) ).strftime("%H:%M:%S"))
	except (ephem.NeverUpError, ephem.AlwaysUpError):
		polaris_data.append('-')

	# append polaris alt
	polaris_data.append(polaris.alt)

	return polaris_data

def get_gps():
	gps_data = []
	timeout = datetime.timedelta(seconds=30)
	loop_time = 1
	gps_start_time = datetime.datetime.utcnow()
	status = 'Trying GPS'

	gpsd_socket = gps3.GPSDSocket()
	gpsd_socket.connect()
	gpsd_socket.watch()
	data_stream = gps3.DataStream()

	for new_data in gpsd_socket:
		waiting_time = datetime.datetime.utcnow() - gps_start_time
		if waiting_time > timeout:
			raise gpsTimeout("GPS timeout")
		if new_data:
			data_stream.unpack(new_data)
			if data_stream.TPV['lat'] != 'n/a' and int(data_stream.TPV['mode']) == 3:
				gps_data.append(data_stream.TPV['lat'])
				gps_data.append(data_stream.TPV['lon'])
				gps_data.append(data_stream.TPV['alt'])
				gps_data.append(data_stream.TPV['time'])
				break
		else:
			time.sleep(loop_time)
		if DEBUG:
			status = status + '.'
			print("%s" % status, end = '\r')

	gpsd_socket.close()
	return gps_data

def get_location():
	location = []
	config_file = "/etc/astropanel.conf"
	user_weather_file = "/home/astroberry/.config/lxpanel/LXDE-astroberry/panels/panel"
	system_weather_file  = "/etc/xdg/lxpanel/LXDE-astroberry/panels/panel"

	if os.path.isfile(config_file):
		config = configparser.ConfigParser()
		config.read(config_file)
		if 'use_gps' in config['default'] and config['default']['use_gps'] in ['true', 'True', 'TRUE', 'yes', 'Yes', 'YES', '1']:
			try:
				gps_data = get_gps()
				latitude = "%s" % gps_data[0]
				longitude = "%s" % gps_data[1]
				elevation = "%.2f" % gps_data[2]
				city = 'GPS location'
				alias = 'GPS location'
				position_mode = 'gps'
				if DEBUG:
					print("Loading values from GPS")
					print(position_mode)
					print(latitude)
					print(longitude)
					print(elevation)
					print(city)
					print(alias)
				location.append(latitude)
				location.append(longitude)
				location.append(elevation)
				location.append(city)
				location.append(alias)
				location.append(position_mode)
			except gpsTimeout:
				if 'latitude' in config['default'] and 'longitude' in config['default'] and 'elevation' in config['default'] and 'city' in config['default'] and 'alias' in config['default']:
					latitude = config['default']['latitude']
					longitude = config['default']['longitude']
					elevation = config['default']['elevation']
					city = config['default']['city']
					alias = config['default']['alias']
					position_mode = config_file
					if DEBUG:
						print("No GPS data available. Falling back to configuration file")
						print(position_mode)
						print(latitude)
						print(longitude)
						print(elevation)
						print(city)
						print(alias)
					location.append(latitude)
					location.append(longitude)
					location.append(elevation)
					location.append(city)
					location.append(alias)
					location.append(position_mode)
		else:
			if 'latitude' in config['default'] and 'longitude' in config['default'] and 'elevation' in config['default'] and 'city' in config['default'] and 'alias' in config['default']:
				latitude = config['default']['latitude']
				longitude = config['default']['longitude']
				elevation = config['default']['elevation']
				city = config['default']['city']
				alias = config['default']['alias']
				position_mode = config_file
				if DEBUG:
					print("Loading values from configuration file")
					print(position_mode)
					print(latitude)
					print(longitude)
					print(elevation)
					print(city)
					print(alias)
				location.append(latitude)
				location.append(longitude)
				location.append(elevation)
				location.append(city)
				location.append(alias)
				location.append(position_mode)
	elif os.path.isfile(user_weather_file):
		with open(user_weather_file,'r') as file:
			for line in file:
				latitude_line = re.findall('latitude=.*', line)
				longitude_line = re.findall('longitude=.*', line)
				city_line = re.findall('city=.*', line)
				alias_line = re.findall('alias=.*', line)
				if latitude_line:
					latitude = latitude_line[0].split('=')[1]
				if longitude_line:
					longitude = longitude_line[0].split('=')[1]
				elevation = 0
				if city_line:
					city = city_line[0].split('=')[1]
				if alias_line:
					alias = alias_line[0].split('=')[1]
		position_mode = user_weather_file
		if DEBUG:
			print("Loading values from user weather file")
			print(position_mode)
			print(latitude)
			print(longitude)
			print(elevation)
			print(city)
			print(alias)
		location.append(latitude)
		location.append(longitude)
		location.append(elevation)
		location.append(city)
		location.append(alias)
		location.append(position_mode)
	elif os.path.isfile(system_weather_file):
		with open(system_weather_file,'r') as file:
			for line in file:
				latitude_line = re.findall('latitude=.*', line)
				longitude_line = re.findall('longitude=.*', line)
				city_line = re.findall('city=.*', line)
				alias_line = re.findall('alias=.*', line)
				if latitude_line:
					latitude = latitude_line[0].split('=')[1]
				if longitude_line:
					longitude = longitude_line[0].split('=')[1]
				elevation = 0
				if city_line:
					city = city_line[0].split('=')[1]
				if alias_line:
					alias = alias_line[0].split('=')[1]
		position_mode = system_weather_file
		if DEBUG:
			print("Loading values from system weather file")
			print(position_mode)
			print(latitude)
			print(longitude)
			print(elevation)
			print(city)
			print(alias)
		location.append(latitude)
		location.append(longitude)
		location.append(elevation)
		location.append(city)
		location.append(alias)
		location.append(position_mode)

	if not location:
		# no location data - loading defaults
		latitude = '52.237049'
		longitude = '21.017532'
		elevation = 0
		city = 'Warsaw'
		alias = 'Demo location'
		position_mode = 'demo'
		if DEBUG:
			print("No location data available. Loading defaults")
			print(latitude)
			print(longitude)
			print(elevation)
			print(city)
			print(alias)
			print(position_mode)
		location.append(latitude)
		location.append(longitude)
		location.append(elevation)
		location.append(city)
		location.append(alias)
		location.append(position_mode)

	return location

def background_thread():
	while True:
		# update location
		location = get_location()

		# init observer
		home = ephem.Observer()

		# set geo position
		home.lat = location[0]
		home.lon = location[1]
		home.elevation = float(location[2])

		# update time
		t = datetime.datetime.utcnow()
		home.date = t

		polaris_data = get_polaris_data(home)

		socketio.emit('celestialdata', {
		'latitude': "%s" % home.lat,
		'longitude': "%s" % home.lon,
		'elevation': "%.2f" % home.elevation,
		'city': location[3],
		'alias': location[4],
		'mode': location[5],
		'polaris_hour_angle': polaris_data[0],
		'polaris_next_transit': "%s" % polaris_data[1],
		'polaris_alt': "%.2f°" % numpy.degrees(polaris_data[2]),
		'moon_phase': "%s" % get_moon_phase(home),
		'moon_light': "%d" % ephem.Moon(home).phase,
		'moon_rise': "%s" % get_body_positions(home,ephem.Moon(home))[0],
		'moon_transit': "%s" % get_body_positions(home,ephem.Moon(home))[1],
		'moon_set': "%s" % get_body_positions(home,ephem.Moon(home))[2],
		'moon_az': "%.2f°" % numpy.degrees(ephem.Moon(home).az),
		'moon_alt': "%.2f°" % numpy.degrees(ephem.Moon(home).alt),
		'moon_ra': "%s" % ephem.Moon(home).ra,
		'moon_dec': "%s" % ephem.Moon(home).dec,
		'moon_new': "%s" % ephem.localtime(ephem.next_new_moon(t)).strftime("%Y-%m-%d %H:%M:%S"),
		'moon_full': "%s" % ephem.localtime(ephem.next_full_moon(t)).strftime("%Y-%m-%d %H:%M:%S"),
		'sun_at_start': get_sun_twilights(home)[2][0],
		'sun_ct_start': get_sun_twilights(home)[0][0],
		'sun_rise': "%s" % get_body_positions(home,ephem.Sun(home))[0],
		'sun_transit': "%s" % get_body_positions(home,ephem.Sun(home))[1],
		'sun_set': "%s" % get_body_positions(home,ephem.Sun(home))[2],
		'sun_ct_end': get_sun_twilights(home)[0][1],
		'sun_at_end': get_sun_twilights(home)[2][1],
		'sun_az': "%.2f°" % numpy.degrees(ephem.Sun(home).az),
		'sun_alt': "%.2f°" % numpy.degrees(ephem.Sun(home).alt),
		'sun_ra': "%s" % ephem.Sun(home).ra,
		'sun_dec': "%s" % ephem.Sun(home).dec,
		'sun_equinox': "%s" % ephem.localtime(ephem.next_equinox(t)).strftime("%Y-%m-%d %H:%M:%S"),
		'sun_solstice': "%s" % ephem.localtime(ephem.next_solstice(t)).strftime("%Y-%m-%d %H:%M:%S"),
		'mercury_rise': "%s" % get_body_positions(home,ephem.Mercury(home))[0],
		'mercury_transit': "%s" % get_body_positions(home,ephem.Mercury(home))[1],
		'mercury_set': "%s" % get_body_positions(home,ephem.Mercury(home))[2],
		'mercury_az': "%.2f°" % numpy.degrees(ephem.Mercury(home).az),
		'mercury_alt': "%.2f°" % numpy.degrees(ephem.Mercury(home).alt),
		'venus_rise': "%s" % get_body_positions(home,ephem.Venus(home))[0],
		'venus_transit': "%s" % get_body_positions(home,ephem.Venus(home))[1],
		'venus_set': "%s" % get_body_positions(home,ephem.Venus(home))[2],
		'venus_az': "%.2f°" % numpy.degrees(ephem.Venus(home).az),
		'venus_alt': "%.2f°" % numpy.degrees(ephem.Venus(home).alt),
		'mars_rise': "%s" % get_body_positions(home,ephem.Mars(home))[0],
		'mars_transit': "%s" % get_body_positions(home,ephem.Mars(home))[1],
		'mars_set': "%s" % get_body_positions(home,ephem.Mars(home))[2],
		'mars_az': "%.2f°" % numpy.degrees(ephem.Mars(home).az),
		'mars_alt': "%.2f°" % numpy.degrees(ephem.Mars(home).alt),
		'jupiter_rise': "%s" % get_body_positions(home,ephem.Jupiter(home))[0],
		'jupiter_transit': "%s" % get_body_positions(home,ephem.Jupiter(home))[1],
		'jupiter_set': "%s" % get_body_positions(home,ephem.Jupiter(home))[2],
		'jupiter_az': "%.2f°" % numpy.degrees(ephem.Jupiter(home).az),
		'jupiter_alt': "%.2f°" % numpy.degrees(ephem.Jupiter(home).alt),
		'saturn_rise': "%s" % get_body_positions(home,ephem.Saturn(home))[0],
		'saturn_transit': "%s" % get_body_positions(home,ephem.Saturn(home))[1],
		'saturn_set': "%s" % get_body_positions(home,ephem.Saturn(home))[2],
		'saturn_az': "%.2f°" % numpy.degrees(ephem.Saturn(home).az),
		'saturn_alt': "%.2f°" % numpy.degrees(ephem.Saturn(home).alt),
		'uranus_rise': "%s" % get_body_positions(home,ephem.Uranus(home))[0],
		'uranus_transit': "%s" % get_body_positions(home,ephem.Uranus(home))[1],
		'uranus_set': "%s" % get_body_positions(home,ephem.Uranus(home))[2],
		'uranus_az': "%.2f°" % numpy.degrees(ephem.Uranus(home).az),
		'uranus_alt': "%.2f°" % numpy.degrees(ephem.Uranus(home).alt),
		'neptune_rise': "%s" % get_body_positions(home,ephem.Neptune(home))[0],
		'neptune_transit': "%s" % get_body_positions(home,ephem.Neptune(home))[1],
		'neptune_set': "%s" % get_body_positions(home,ephem.Neptune(home))[2],
		'neptune_az': "%.2f°" % numpy.degrees(ephem.Neptune(home).az),
		'neptune_alt': "%.2f°" % numpy.degrees(ephem.Neptune(home).alt)
		})
		socketio.sleep(60)

def shut_down():
    print('Keyboard interrupt received\nTerminated by user\nGood Bye.\n')
    sys.exit()

@app.route('/')
def main():
	return render_template('main.html')

@socketio.on('connect')
def handle_connect():
	global thread
	if thread is None:
		thread = socketio.start_background_task(target=background_thread)

if __name__ == '__main__':
	try:
		socketio.run(app, host='0.0.0.0', port = 8626, debug=False)
	except KeyboardInterrupt:
		shut_down()
