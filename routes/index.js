const express = require('express')
const passport = require('passport')
const bcrypt = require('bcrypt')
const axios = require('axios')
const qs = require('qs')
const bcryptSalt = 10
const connectEnsure = require('connect-ensure-login')
const ensureLoggedIn = connectEnsure.ensureLoggedIn('/login');

const User = require('../models/user')

const router = express.Router()

// ====== Home Page ======
router.get('/', (req, res, next) => {
  res.render('index')
});

// ====== Sign-Up Page ======
router.get('/signup', (req, res, next) => {
  res.render('auth/signup', {
    errorMessage: false
  })
})

router.post('/signup', (req, res, next) => {
  let salt = bcrypt.genSaltSync(bcryptSalt)
  let hashPass = bcrypt.hashSync(req.body.password, salt)

  User.findOne({
    username: req.body.username
  }, (error, user) => {
    if (user) res.render('auth/signup', {
      errorMessage: 'This username is already taken :('
    })
    else {
      let newUser = new User({
        username: req.body.username,
        password: hashPass,
        bandcampUsername: '',
        bandcampID: '',
        email: '',
        favoriteArtists: []
      })

      newUser.save((error) => {
        if (error) res.render('auth/signup', {
          errorMessage: 'Something went wrong'
        })
        else {
          res.redirect('/bandcampsetup')
        }
      })
    }
  })
})

// ====== Log-In Page ======
router.get('/login', (req, res, next) => {
  res.render('auth/login', {
    errorMessage: false
  })
})

router.post('/login', passport.authenticate('local', {
  successRedirect: '/home',
  failureRedirect: '/login',
  failureFlash: false,
  passReqToCallback: true
}));

// ====== Bandcamp Set-Up Page ======
router.get('/bandcampsetup', ensureLoggedIn, (req, res, next) => {
  res.render('auth/bandcampsetup', {errorMessage: false})
})

router.post('/bandcampsetup', ensureLoggedIn, (req, res, next) => {
  let BCusername = req.body.bandcampUsername
  getBandcampID(BCusername)
  .then( (id) => {
    console.log(req.user)
    console.log('SUCCESS ', id)
    User.findByIdAndUpdate({_id: req.user._id}, { bandcampID: id }, (error) => {
      res.redirect('/home')
    })
  })
  .catch( (error) => {
    console.log('error caught')
    res.render('auth/bandcampsetup', {errorMessage: "Couldn't find this username on Bandcamp"})
  })
})

// ====== Bandcamp Set-Up Page ======
router.get('/home', (req, res, next) => {
  res.render('home')
})

function getBandcampID (BCusername) {
  return axios.get(`https://bandcamp.com/${BCusername}`)
  .then( (response) => {
    let response_str = response['data']
    let start_index = response_str.indexOf('id="follow-unfollow') + 20
    let ID = response_str.substring(start_index, response_str.indexOf('"', start_index))
    return ID
  })
  .catch( (error) => {
    throw error
  })
}

module.exports = router;