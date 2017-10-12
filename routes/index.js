const express = require("express");
const passport = require("passport");
const bcrypt = require("bcrypt");
const axios = require("axios");
const qs = require("qs");
const SpotifyWebApi = require('spotify-web-api-node')

const bcryptSalt = 10;
const connectEnsure = require("connect-ensure-login");
const ensureLoggedIn = connectEnsure.ensureLoggedIn("/login");

// ======================================
//          Importing Data Models
// ======================================
const User = require("../models/user");
const Album = require("../models/album");
const Story = require("../models/story");


// ======================================
//          Setting-up Spotify
// ======================================
const client_id = 'fb0f83f7ed6e45f5a3c7729074b4e8dc'
const client_secret = '784c6f633f204ac690a897d9d11ee1f8'

const spotifyApi = new SpotifyWebApi({
  clientId: client_id,
  clientSecret: client_secret
})

spotifyApi.clientCredentialsGrant()
  .then((data) => {
    spotifyApi.setAccessToken(data.body['access_token'])
  }, (err) => {
    console.log('Something went wrong when retrieving an access token', err)
  })



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
        console.log('CHECK ', entry.story_type, entry.story_type === 'fp')
        if (entry.story_type === 'fp') {
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
              console.log("story saved")
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
                buyCount: entry.also_collected_count,
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
        }
      });
      constructFeed(req.user._id).then(albums => {
        let albumsList = albums.sort((a, b) => {
          return b[0].buyCount - a[0].buyCount
        })
        console.log(albumsList)
        res.render("home", {
          rows: albumsList.length - (albumsList.length % 3),
          albumsList: albumsList,
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
router.get('/listen/:num', ensureLoggedIn, (req, res, next) => {
  let index = req.params.num - 1
  let listenList = req.user.listenList
  let currentAlbumID = listenList[index]
  let album_URL = `https://bandcamp.com/EmbeddedPlayer/v=2/album=${currentAlbumID}/size=large/tracklist=true/artwork=small/`
  axios.get(album_URL)
    .then(function (response) {
      let HTML = response.data
      let musicPlayerData = JSON.parse(HTML.match(/var\s*playerdata\s*=\s*(.+);/)[1]);
      console.log(musicPlayerData.tracks)

      // This part either displays or not the arrows, depending on the user's postion
      // in the Listen List
      let displayArrows = {
        prev: true,
        next: true
      }
      if (index === 0) displayArrows.prev = false
      if (index === listenList.length - 1) displayArrows.next = false

      Album.find({
          albumBandcampID: currentAlbumID
        })
        .then((currentAlbum) => {
          res.render('listenPage', {
            index,
            currentAlbum: currentAlbum[0],
            listenListLength: listenList.length,
            tracks: musicPlayerData.tracks,
            displayArrows,
          })
        })
    })
    .catch((error) => {
      console.log(error)
    })

})


//  ====== Add to Listen Mode ======
router.get('/add/:id', ensureLoggedIn, (req, res, next) => {
  let albumBandcampID = req.params.id
  let userID = req.user._id
  axios.post(`http://localhost:3000/add/${albumBandcampID}/${userID}`)
})

router.post('/add/:id/:user', (req, res, next) => {
  let albumBandcampID = req.params.id
  let userID = req.params.user

  User.findByIdAndUpdate({
    _id: userID
  }, {
    $addToSet: {
      listenList: albumBandcampID
    }
  }).catch((error) => {
    console.log(error)
  })
})

//  ====== User feedback - Sucks ======
router.get('/listen/:index/sucks', ensureLoggedIn, (req, res, next) => {
  let currentIndex = req.params.index - 2
  let _id = req.user._id
  let itemToRemove = req.user.listenList[currentIndex].toString()
  User.findByIdAndUpdate({
    _id
  }, {
    $pull: {
      listenList: itemToRemove
    }
  }).then((user) => {
    if (req.params.index - 1 === req.user.listenList.length) {
      res.redirect(`/listen/${req.params.index - 2}`)
    } else {
      res.redirect(`/listen/${req.params.index - 1}`)
    }
  })
})

//  ====== User feedback - Rocks ======
router.get('/listen/:index/rocks', ensureLoggedIn, (req, res, next) => {
  let currentIndex = req.params.index - 2
  let _id = req.user._id
  let itemToRemove = req.user.listenList[currentIndex].toString()
  User.findByIdAndUpdate({
      _id
    }, {
      $pull: {
        listenList: itemToRemove
      }
    })
    .then((user) => {
      if (req.params.index - 1 === req.user.listenList.length) {
        // res.redirect(`/listen/${req.params.index - 2}`)
      } else {
        // res.redirect(`/listen/${req.params.index - 1}`)
      }
    })
})


// ====== Fetching User Bandcamp feed ======
// Following is Eduardo's code with fan_id replaced
async function getBandcampFeed(bandcampID) {
  try {
    const a = await axios.post(
      "https://bandcamp.com/fan_dash_feed_updates",
      qs.stringify({
        fan_id: bandcampID,
        older_than: 999999999990
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
    const promises = stories.map(story => {
      if (story.type === 'fp') {
        console.log('ADDED ONE')
        return Album.find({
          albumBandcampID: story.album
        })
      }
    });
    return Promise.all(promises);
  });
}


function spotifyTestFunc(requestedAlbum) {
  return spotifyApi.searchArtists(requestedAlbum.artist)
    .then((searchResult) => searchResult.body.artists.items)
    .then((artists) => {
      const promises = artists.map(artist => {
        return spotifyApi.getArtistAlbums(artist.id).then((searchResult) => searchResult.body.items)
          .then((albums) => {
            return albums.map((album) => {
              if (album.name.toLowerCase() === requestedAlbum.title.toLowerCase()) {
                return album.external_urls.spotify
              }
            }).find(v => v)
          })
      }).filter(v => v)
      const albums = Promise.all(promises)
    })
    .catch((error) => console.log('Spotify Error, line 364', error))


}

module.exports = router;