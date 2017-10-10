const mongoose = require("mongoose");
const Schema = mongoose.Schema;


storySchema = new Schema({
  date: Date,
  fanBandcampID: String,
  buyCount: Number,
  type: String,
  album: {
    type: Schema.Types.ObjectId,
    ref: 'Album'
  }
});


const Story = mongoose.model("Story", storySchema);

module.exports = Story;
