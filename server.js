'use strict';

require ('dotenv').config();
const express = require('express');
const pg = require('pg');
const superagent = require('superagent');
let googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_MAPS_API_KEY,
  Promise: Promise
});

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
  console.log('ADDRESS: ', address, 'zip: ', zip, 'city: ', city, 'state: ', state.toUpperCase());

  const googAddr = `${address}, ${city}, ${state.toUpperCase()}`;
  console.log('googAddr: ', googAddr);

  googleMapsClient.geocode({address: googAddr})
    .asPromise()
    .then((response) => {
      console.log(response.json.results);
    })
    .catch((err) => {
      console.log(err);
    });
}