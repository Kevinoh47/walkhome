'use strict';

require ('dotenv').config();
const express = require('express');
const pg = require('pg');
const superagent = require('superagent');

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
app.get('/', (request, response) => { response.send('Walkhome Landing Page');});

// 404
app.use('*', (request, response) => {response.render('pages/error');});

// listener
app.listen(PORT, () => console.log('listening on PORT',PORT));