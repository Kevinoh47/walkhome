'use strict';

require ('dotenv').config();
const express = require('express');
const pg = require('pg');

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
app.post('/address', getAddressData);

app.post('/save-search', saveSearch);
//app.get(/save-search, showSavedSearches) // todo: show all the saved searches (by user)

// 404
app.use('*', (request, response) => {response.render('pages/error');});

// listener
app.listen(PORT, () => console.log('listening on PORT',PORT));

// Callback functions
function saveSearch(request, response) {
  let {address, zip, city, state, neighborhood, walkscore, ws_explanation, ws_link} = request.body;
  let sql = `INSERT INTO address_search(address, zip, city, state, neighborhood, walkscore, ws_explanation, ws_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
  let values = [address, zip, city, state, neighborhood, walkscore, ws_explanation, ws_link];

  client.query(sql, values)
    // .then(
    //   getIdFromAddressSearchTable(request,response)
    // )
    .then(results => {
      console.log({results});
      response.render('pages/saved-search', {search : values, message: 'you saved a search!'});
    })
    .catch(err => {
      console.error(err);
      response.status(500).send(err);
    });
}

// function getIdFromAddressSearchTable(request,response) {
//   let {address, zip, city, state, neighborhood} = request.body;
//   let sql = `SELECT id FROM address_search WHERE address = $1 AND zip = $2 AND city = $3 AND state = $4 and neighborhood =$5;`;
//   let values = [address, zip, city, state, neighborhood];
// }

function getAddressData(request, response) {
  let myNeighborhood = [];
  let hoodStr = 'Unknown';
  getNeighborhood(request, response)
    .then(results => {
      myNeighborhood = results.body.results[0].address_components.filter(obj => {
        return obj.types.includes('neighborhood');
      });
      if(myNeighborhood[0].short_name || myNeighborhood[0].long_name) {
        hoodStr = (myNeighborhood[0].short_name) ? myNeighborhood[0].short_name : myNeighborhood[0].long_name;
      }
    });

  getGeocodedData(request, response)
    .then(geocodedResults => prepWalkScoreRequest(geocodedResults))
    .then(walkScoreUrl => getWalkScore(request, response, walkScoreUrl))
    .then(addressArr => {
      response.render('pages/address-results', {walkScoreInfo: addressArr, neighborhood: hoodStr});
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

function getNeighborhood(request, response){
  const {address, zip, city, state} = request.body;
  const myAddress = `${address}, ${city}, ${state}, ${zip}`;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${myAddress}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  return superagent.get(url);
}
