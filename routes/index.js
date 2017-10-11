const express = require("express");
const passport = require("passport");
const bcrypt = require("bcrypt");
const axios = require("axios");
const qs = require("qs");
const bcryptSalt = 10;
const connectEnsure = require("connect-ensure-login");
const ensureLoggedIn = connectEnsure.ensureLoggedIn("/login");

const User = require("../models/user");
const Album = require("../models/album");
const Story = require("../models/story");

const router = express.Router();

// ====== Home Page ======
router.get("/", (req, res, next) => {
  res.render("index");
});

// ====== Sign-Up Page ======
router.get("/signup", (req, res, next) => {
  res.render("auth/signup", {
    errorMessage: false
  });
});

router.post("/signup", (req, res, next) => {
  let salt = bcrypt.genSaltSync(bcryptSalt);
  let hashPass = bcrypt.hashSync(req.body.password, salt);

  User.findOne({
      username: req.body.username
    })
    .then(user => {
      if (user) res.render("auth/signup", {
        errorMessage: "This username is already taken :("
      })
      else {
        let newUser = new User({
          username: req.body.username,
          password: hashPass,
          bandcampUsername: "",
          bandcampID: "",
          email: "",
          favoriteArtists: []
        });

        newUser.save(error => {
          if (error)
            res.render("auth/signup", {
              errorMessage: "Something went wrong"
            });
          else {
            console.log("redirection after signup");
            passport.authenticate("local")(req, res, () => {
              res.redirect("/bandcampsetup");
            });
          }
        });
      }
    });
});

// ====== Log-In Page ======
router.get("/login", (req, res, next) => {
  res.render("auth/login", {
    errorMessage: false
  });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureFlash: false,
    passReqToCallback: true
  })
);

// ====== Bandcamp Set-Up Page ======
router.get("/bandcampsetup", ensureLoggedIn, (req, res, next) => {
  res.render("auth/bandcampsetup", {
    errorMessage: false
  });
});

router.post("/bandcampsetup", ensureLoggedIn, (req, res, next) => {
  let BCusername = req.body.bandcampUsername;
  getBandcampID(BCusername)
    .then(id => {
      User.findByIdAndUpdate({
          _id: req.user._id
        }, {
          bandcampID: id
        },
        error => {
          res.redirect("/home");
        }
      );
    })
    .catch(error => {
      res.render("auth/bandcampsetup", {
        errorMessage: "Couldn't find this username on Bandcamp"
      });
    });
});

function getBandcampID(BCusername) {
  return axios
    .get(`https://bandcamp.com/${BCusername}`)
    .then(response => {
      let response_str = response["data"];
      let start_index = response_str.indexOf('id="follow-unfollow') + 20;
      let ID = response_str.substring(
        start_index,
        response_str.indexOf('"', start_index)
      );
      return ID;
    })
    .catch(error => {
      throw error;
    });
}

// ====== Bandaid User Home ======
router.get("/home", ensureLoggedIn, (req, res, next) => {
  getBandcampFeed(req.user.bandcampID)
    .then(feed_array => {
      console.log(feed_array)
      // console.log(feed_array[3])
      feed_array.forEach(entry => {
        let newStory = new Story({
          date: entry.story_date,
          fanBandcampID: entry.fan_id,
          buyCount: entry.also_collected_count,
          type: entry.story_type,
          album: entry.album_id,
          user: req.user._id
        });
        // console.log(newStory);
        Story.findOne({
          fanBandcampID: entry.fan_id,
          album: entry.album_id,
          user: req.user._id
        }).then(story => {
          if (story) console.log("Story already exists")
          else {
            newStory.save();
            let genre = entry.tags.map(tag => {
              return tag.name;
            });
            let newAlbum = new Album({
              title: entry.album_title,
              albumBandcampID: entry.album_id,
              genres: genre,
              artist: entry.band_name,
              artistBandcampID: entry.band_id,
              coverURL: entry.item_art_url,
              itemURL: entry.item_url,
              label: entry.label,
              price_obj: {
                price: entry.price,
                currency: entry.currency
              }
            });
            Album.findOne({
              albumBandcampID: entry.album_id
            }).then(album => {
              if (album) console.log("Album already exists")
              else {
                newAlbum.save()
                  .then(console.log('Album saved', newAlbum._id));
              }
            });
          }
        });
      });
      constructFeed(req.user._id).then(albums => {
        res.render("home", {

          albums: albums,
          errorMessage: false
        });
      });
    })
    .catch(err => {
      console.log("error", err);
    });
});


//  ====== Listen Mode Page ======
// ADD INSURE LOGGED IN WHEN DONE WITH TESTINGx

// https://bandcamp.com/EmbeddedPlayer/v=2/album=1167778992/size=large/tracklist=true/artwork=small/
router.get('/listen/:num', (req, res, next) => {
  let index = req.params.num - 1
  let listenList = [
    [{
      _id: '59dcd37be32e431b1999dca3',
      title: 'Ivrjèn',
      albumBandcampID: '2429722687',
      artist: 'Torba',
      artistBandcampID: '3935990010',
      coverURL: 'http://f4.bcbits.com/img/a1078811021_9.jpg',
      itemURL: 'http://conjuntovacio.bandcamp.com/album/ivrj-n',
      label: null,
      __v: 0,
      price_obj: [Object],
      genres: [Array]
    }],
    [{
      _id: '59dcd37be32e431b1999dca4',
      title: 'Repeating',
      albumBandcampID: '2418784641',
      artist: 'Videoblu',
      artistBandcampID: '3935990010',
      coverURL: 'http://f4.bcbits.com/img/a1140095599_9.jpg',
      itemURL: 'http://conjuntovacio.bandcamp.com/album/repeating',
      label: null,
      __v: 0,
      price_obj: [Object],
      genres: [Array]
    }]
  ]
  let currentAlbum = listenList[index][0]
  let albumBandcampID = currentAlbum.albumBandcampID
  let album_URL = `https://bandcamp.com/EmbeddedPlayer/v=2/album=${albumBandcampID}/size=large/tracklist=true/artwork=small/`
  axios.get(album_URL)
  .then(function (response) {
    let HTML = response.data
    let musicPlayerData = JSON.parse(HTML.match(/var\s*playerdata\s*=\s*(.+);/)[1]);
    console.log(musicPlayerData.tracks)
    res.render('listenPage', {
      index,
      listenListLength: listenList.length,
      tracks: musicPlayerData.tracks
    })
  })
  .catch(function (error) {
    console.log(error);
  });
})


// ====== Fetching User Bandcamp feed ======

// Following is Eduardo's code with fan_id replaced

async function getBandcampFeed(bandcampID) {
  try {
    const a = await axios.post(
      "https://bandcamp.com/fan_dash_feed_updates",
      qs.stringify({
        fan_id: bandcampID
        // older_than: 1483605566
      }), {
        headers: {
          Cookie: "client_id=066071D749E770DABEDA6A53D3D59BAEE19651A0DCE19E0A8A667F165E24FDBF; unique_24h=223; want_https=1; identity=6%09efbc233f4349282ad61de8f592ab1fda%09%7B%22id%22%3A4147611151%2C%22h1%22%3A%22819f670ef1890f499a5c62baa315ffb8%22%2C%22ex%22%3A0%7D; session=1%09t%3A1507291939%09r%3A%5B%22261569836S0c0x1507292079%22%2C%22241753119x0c0x1507292003%22%2C%2218185G0f0x1507291939%22%5D; fan_visits=503214; BACKENDID=bender06-1",
          "Content-type": "application/x-www-form-urlencoded"
        }
      }
    );
    return a.data.stories.entries;
  } catch (err) {
    throw err;
  }
}

function constructFeed(id) {
  return Story.find({
    user: id
  }).then(stories => {
    const promises = stories.map(story =>
      Album.find({
        albumBandcampID: story.album
      })
    );
    return Promise.all(promises);
  });
}

module.exports = router;