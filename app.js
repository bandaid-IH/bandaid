require("dotenv").config();
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const passport = require('passport')
const session = require("express-session");
const LocalStrategy = require("passport-local").Strategy
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const flash = require("connect-flash");

const app = express();

// Data Models
const User = require('./models/user')

// Controllers
const index = require('./routes/index')

// Mongoose Configuration
mongoose.connect(process.env.MONGODB_URI)



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main-layout');
app.use(expressLayouts);
app.locals.title = 'Bandaid';

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));

// APP CONFIG
app.use(session({
  secret: "our-passport-local-strategy-app",
  resave: true,
  saveUninitialized: true
}));


// PASSSPORT CONFIG
passport.serializeUser((user, cb) => {
  cb(null, user._id)
});

passport.deserializeUser((id, cb) => {
  User.findOne({
    "_id": id
  }, (err, user) => {
    if (err) {
      return cb(err);
    }
    cb(null, user);
  });
});

passport.use(new LocalStrategy({
  passReqToCallback: true
}, (req, username, password, next) => {
  User.findOne({
    username
  }, (err, user) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(null, false, {
        message: "Incorrect username"
      });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return next(null, false, {
        message: "Incorrect password"
      });
    }

    return next(null, user);
  });
}));

// Initializing Session
app.use(passport.initialize());
app.use(passport.session());


app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  res.render('errorpage')
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
