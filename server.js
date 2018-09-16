'use strict';

require ('dotenv').config();
const express = require('express');
const pg = require('pg');

const superagent = require('superagent');

const nodeGeocoder = require('node-geocoder');
const options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  formatter: null
};
const geocoder = nodeGeocoder(options);

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

app.get('/address', (request, response) => {
  response.render('pages/address');}
);
app.post('/address', getAddressData);

// save a search
app.post('/save-search', saveSearch);

// get saved searches landing page (landing page necessary to get userId)
app.get('/saved-searches', function(request, response) {
  response.render('pages/saved-search-intermediate');
});

app.get('/about', (request, response) => { response.render('pages/about');});

// request saved searches.
app.post('/saved-searches', showSavedSearches);

// add a user
app.post('/login', checkUser);
app.get('/login', (request, response) => {response.render('pages/login');});
app.get('/login-message', (request, response) => {response.render('pages/login-message');});

// 404
app.use('*', (request, response) => {response.render('pages/error');});

// listener
app.listen(PORT, () => console.log('listening on PORT', PORT));

// Callback functions
function checkUser(request, response) {
  let {email, first} = request.body;
  let values = [email];
  let sql = `SELECT id, first_name FROM walkhome_user WHERE email = $1;`;
  client.query(sql,values)
    .then(result => {
      if (result.rows[0] && result.rows[0].id) {
        let userId = result.rows[0].id;
        if (!first) { first = result.rows[0].first_name; }
        if (userId > 0) {
          return response.render('pages/login-message', {email: email, userId: userId, login_required: false, message: `Welcome back ${first}!`});
        }
      }
      else {
        addUser (request, response);
      }
    })
    .catch(err => {
      console.error(err);
      response.status(500).send(err);
    });
}

function addUser (request, response) {
  let {email, first, last, phone} = request.body;
  let sql = `INSERT INTO walkhome_user(email, first_name, last_name, phone_number) VALUES( $1, $2, $3, $4);`;
  let values = [email, first, last, phone];
  client.query(sql, values)
    .then(result => {
      response.render('pages/login-message', {email: email, userId: 0, login_required: true, message: `Welcome, ${first}, you are now a Walkhome member! Please click to login.`});
    })
    .catch(err => {
      console.error(err);
      response.status(500).send(err);
    });
}

function showSavedSearches (request, response) {
  let {userId} = request.body;
  const sql = `SELECT a.address, a.zip, a.city, a.state, a.neighborhood, a.walkscore, a.ws_explanation, a.ws_link FROM address_search a JOIN saved_search b ON a.id = b.address_search_id WHERE b.user_id = ${userId} order by id DESC;`;

  client.query(sql)
    .then(results => {
      response.render('pages/show-saved-searches', {searches : results.rows, message: 'Here are your saved searches.'});
    });
}

function getAddressSearchIdByGuid(myGuid) {
  let castedGuid = myGuid.toString();
  let sql = `SELECT id FROM address_search WHERE search_guid = $1`;
  let values = [castedGuid];

  return client.query(sql, values)
    .then(results =>
    {
      return results;
    })
    .catch(err => {
      console.error({err});
    });

}
// source: https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function saveSearch(request, response) {
  let {address, zip, city, state, neighborhood, walkscore, ws_explanation, ws_link, userId} = request.body;

  const myGuid = uuidv4();

  const searchSql = `INSERT INTO address_search(address, zip, city, state, neighborhood, walkscore, ws_explanation, ws_link, search_guid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
  const searchValues = [address, zip, city, state, neighborhood, walkscore, ws_explanation, ws_link, myGuid];

  client.query(searchSql, searchValues)
    .then(results => {
      getAddressSearchIdByGuid(myGuid)
        .then(result => {
          const addressSearchId = result.rows[0].id;
          const linkValues = [userId, addressSearchId];
          const linkSql = `INSERT INTO saved_search(user_id, address_search_id) VALUES($1, $2);`;
          client.query(linkSql, linkValues);
        })
        .catch(err => {
          console.error({err});
        });
    })
    .then(results => {
      response.render('pages/saved-search', {search : searchValues, message: 'you saved a search!'});
    })
    .catch(err => {
      console.error(err);
      response.status(500).send(err);
    });
}

function getAddressData(request, response) {
  let myNeighborhood = [];
  let hoodStr = 'Unknown';

  getNeighborhood(request, response)
    .then(results => {
      myNeighborhood = results.body.results[0].address_components.filter(obj => {
        return obj.types.includes('neighborhood');
      });
      if(myNeighborhood && myNeighborhood[0] && (myNeighborhood[0].short_name || myNeighborhood[0].long_name)) {
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
