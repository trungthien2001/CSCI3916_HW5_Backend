const mongoose = require("mongoose");
const MovieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  genre: {
    type: String,
    required: true,
    enum: [
      "Action",
      "Adventure",
      "Comedy",
      "Drama",
      "Fantasy",
      "Horror",
      "Thriller",
      "Western",
    ],
  },
  actors: [
    {
      actorName: {
        type: String,
        required: true,
      },
      characterName: {
        type: String,
        required: true,
      },
    },
  ],
  imageUrl: {
    type: String,
  },
  avgRating: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("movies", MovieSchema);
