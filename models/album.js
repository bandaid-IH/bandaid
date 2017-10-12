const mongoose = require("mongoose");
const Schema = mongoose.Schema;

albumSchema = new Schema({
  title: String,
  albumBandcampID: String,
  genres: [String],
  artist: String,
  artistBandcampID: String,
  coverURL: String,
  itemURL: String,
  label: String,
  buyCount:Number,
  price_obj: {
    price: Number,
    currency: String
  },
});

const Album = mongoose.model("Album", albumSchema);

module.exports = Album;
