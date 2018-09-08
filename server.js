'use strict';

require('dotenv').config();
const express = require('express');
// const pg = require('pg');

const superagent = require('superagent');

const NodeGeocoder = require('node-geocoder');
const options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  formatter: null
};
const geocoder = NodeGeocoder(options);

const urlencode = require('urlencode');
const walkscoreApiKey = process.env.WALKSCORE_API_KEY;

// application setup
const app = express();
const PORT = process.env.PORT;

// database setup
// const client = new pg.Client(process.env.DATABASE_URL);
// client.connect();
// client.on('error', err => console.error(err));

// middleware setup
// middleware necessary to allow request.body to be parsed
app.use(express.urlencoded({extended:true}));
app.use(express.static('./public'));

// set the view engine for server-side templating
app.set('view engine', 'ejs');

// API routes
app.get('/', (request, response) => { response.render('index');});

app.get('/address', (request, response) => {response.render('pages/address');});
app.post('/address', getAddressData);

// 404
app.use('*', (request, response) => {response.render('pages/error');});

// listener
app.listen(PORT, () => console.log('listening on PORT',PORT));

// Callback functions
function getAddressData(request, response) {
  getGeocodedData(request, response)
    .then(geocodedResults => prepWalkScoreRequest(geocodedResults))
    .then(walkScoreUrl => getWalkScore(request, response, walkScoreUrl))
    .then(addressArr => {
      response.render('pages/address-results', {walkScoreInfo: addressArr});
    });
}

// Helper functions
function getGeocodedData(request, response) {
  const {address, zip, city, state} = request.body;
  const formattedAddr = `${address}, ${city}, ${state}, ${zip}`;
  return geocoder.geocode(formattedAddr);
}

function getWalkScore(request, response, walkScoreUrl){
  return superagent.get(walkScoreUrl)
    .then(walkScore => {
      let addressArr = [];
      addressArr.push(request.body); //address data
      addressArr.push(walkScore.body); //walkscore data
      return addressArr;
    })
    .catch(function(err) {
      console.log({err});
    });
}

function prepWalkScoreRequest(results) {
  const {latitude, longitude, formattedAddress} = results[0];
  const address = urlencode(formattedAddress);
  const url = `http://api.walkscore.com/score?format=json&address=${address}
          &lat=${latitude}&lon=${longitude}&wsapikey=${walkscoreApiKey}`;
  return url;
}