const express = require('express')
const passport = require('passport')
const bcrypt = require('bcrypt')
const bcryptSalt = 10

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
router.get('/bandcampsetup', (req, res, next) => {
  res.render('auth/bandcampsetup')
})

// ====== Bandcamp Set-Up Page ======
router.get('/home', (req, res, next) => {
  res.render('home')
})

module.exports = router;