'use strict';

require ('dotenv').config();
const express = require('express');
const pg = require('pg');
// const superagent = require('superagent');
// const googleMapsClient = require('@google/maps').createClient({
//   key: process.env.GOOGLE_MAPS_API_KEY,
//   Promise: Promise
// });

const NodeGeocoder = require('node-geocoder');
const options = {
  provider: 'google',
  // Optional depending on the providers
  httpAdapter: 'https', // Default
  apiKey: process.env.GOOGLE_MAPS_API_KEY, // for Mapquest, OpenCage, Google Premier
  formatter: null         // 'gpx', 'string', ...
};
const geocoder = NodeGeocoder(options);

const urlencode = require('urlencode');
const walkscoreApiKey = process.env.WALKSCORE_API_KEY;

// application setup
const app = express();
const PORT = process.env.PORT;

// database setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// middleware setup
// middleware necessary to allow request.body to be parsed
app.use(express.urlencoded({extended:true}));
app.use(express.static('./public'));

// set the view engine for server-side templating
app.set('view engine', 'ejs');

// API routes
app.get('/', (request, response) => { response.render('index');});

app.get('/address', (request, response) => {response.render('pages/address');});
app.post('/address', getGoogleMapsData);
// 404
app.use('*', (request, response) => {response.render('pages/error');});

// listener
app.listen(PORT, () => console.log('listening on PORT',PORT));

// Helper functions
function getGoogleMapsData(request, response) {
  const {address, zip, city, state} = request.body;
  const googAddr = `${address}, ${city}, ${state}, ${zip}`;
  console.log('googAddr: ', googAddr);

  geocoder.geocode(googAddr)
    .then(results => prepWalkScoreRequest(results))
    .then(walkScoreUrl => getWalkScore(walkScoreUrl))
    //.then(walkScore => console.log({walkScore})) // in theory, the walkscore values.
    .catch(function(err) {
      console.log(err);
    });
}

function getWalkScore(walkScoreUrl) {
  console.log({walkScoreUrl});
  app.get(walkScoreUrl, function (req, res) {
    console.log('getWalkScoreUrl req: ', req);
    console.log('getWalkScoreUrl res: ', res);
  });
}

function prepWalkScoreRequest(results) {
  console.log('prepWalkScore results input param', results);
  const {latitude, longitude, formattedAddress} = results[0];
  const address = urlencode(formattedAddress);
  const url = `http://api.walkscore.com/score?format=json&address=${address}
          &lat=${latitude}&lon=${longitude}&wsapikey=${walkscoreApiKey}`;
  return url;
}