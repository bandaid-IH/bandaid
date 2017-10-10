const mongoose = require("mongoose");
const Schema = mongoose.Schema;


storySchema = new Schema({
  date: Date,
  fanBandcampID: String,
  buyCount: Number,
  type: String,
  album: String,
  user: String
});


const Story = mongoose.model("Story", storySchema);

module.exports = Story;
