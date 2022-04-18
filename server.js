
var express = require("express");
var bodyParser = require("body-parser");
var passport = require("passport");
var authController = require("./auth");
var authJwtController = require("./auth_jwt");
var jwt = require("jsonwebtoken");
var cors = require("cors");
var User = require("./Users");
const Movies = require("./moviesModel");
const Reviews = require("./reviewsModel");
const rp = require("request-promise");
const crypto = require("crypto");
var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
  var json = {
    headers: "No headers",
    key: process.env.UNIQUE_KEY,
    body: "No body",
  };

  if (req.body != null) {
    json.body = req.body;
  }

  if (req.headers != null) {
    json.headers = req.headers;
  }

  return json;
}

router.post("/signup", function (req, res) {
  if (!req.body.username || !req.body.password) {
    return res.json({
      success: false,
      msg: "Username or Password field is missing. Please include both username and password to signup.",
    });
  } else {
    var user = new User();
    user.name = req.body.name;
    user.username = req.body.username;
    user.password = req.body.password;

    user.save(function (err) {
      if (err) {
        if (err.code === 11000)
          return res.json({
            success: false,
            message: "This User is already exist in our system. Please enter a new user.",
          });
        else return res.json(err);
      }

      return res.json({
        success: true,
        user,
        msg: "Great News! You have successfully created a new user.",
      });
    });
  }
});

router.post("/signin", function (req, res) {
  var userNew = new User();
  userNew.username = req.body.username;
  userNew.password = req.body.password;

  User.findOne({ username: userNew.username })
    .select("name username password")
    .exec(function (err, user) {
      if (err) {
        return res.send(err);
      }

      user.comparePassword(userNew.password, function (isMatch) {
        if (isMatch) {
          var userToken = { id: user.id, username: user.username };
          var token = jwt.sign(userToken, process.env.SECRET_KEY);
          return res.json({ success: true, user, token: "JWT " + token });
        } else {
          return res
            .status(401)
            .send({ success: false, msg: "Authentication failed." });
        }
      });
    });
});

router.get("/movies", authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movies = await Movies.find();
    if (req.query.reviews === "true") {
      Movies.aggregate(
        [
          {
            $lookup: {
              from: "reviews",
              localField: "title",
              foreignField: "movie",
              as: "reviews",
            },
          },
          { $sort: { avgRating: -1 } },
        ],
        (error, result) => {
          if (error) {
            return res.status(500).json(error);
          }
          return res
            .status(200)
            .json({ success: true, msg: "Movie with reviews found", result });
        }
      );
    } else {
      return res.status(200).json(movies);
    }
  } catch (error) {
    return res.status(500).json(error);
  }
});

router.post("/movies", authJwtController.isAuthenticated, (req, res) => {
  const { title, year, genre, actors, imageUrl } = req.body;
  if (!actors || actors.length < 3) {
    return res
      .status(500)
      .json({ success: false, msg: "It Must have at least 3 actors" });
  }
  Movies.create(
    {
      title,
      year,
      genre,
      actors,
      imageUrl,
    },
    (error, movie) => {
      if (error) {
        return res.status(500).json(error);
      }
      return res
        .status(200)
        .json({ success: true, msg: "The Movie has been created", movie });
    }
  );
});

router.get(
  "/movie/:movieID",
  authJwtController.isAuthenticated,
  async (req, res) => {
    try {
      const movie = await Movies.findById(req.params.movieID);
      if (!movie) {
        return res.status(500).json("Sorry! The system could not find the Movie");
      }
      if (req.query.reviews === "true") {
        Movies.aggregate(
          [
            {
              $match: { title: movie.title },
            },
            {
              $lookup: {
                from: "reviews",
                localField: "title",
                foreignField: "movie",
                as: "Reviews",
              },
            },
            { $sort: { avgRating: -1 } },
          ],
          (error, movie) => {
            if (error) {
              return res.status(500).json(error);
            }
            return res
              .status(200)
              .json({ success: true, msg: "The Movie with reviews found", movie });
          }
        );
      } else {
        return res
          .status(200)
          .json({ success: true, msg: "Movie found in the system", movie });
      }
    } catch (error) {
      return res.status(500).json(error);
    }
  }
);
router.put("/movie/:movieID", authJwtController.isAuthenticated, (req, res) => {
  const { title, year, genre, actors } = req.body;
  if (!actors || actors.length < 3) {
    return res
      .status(500)
      .json({ success: false, msg: "Must have at least 3 actors" });
  }

  Movies.findByIdAndUpdate(
    req.params.movieID,
    {
      $set: { title: title, year: year, genre: genre, actors: actors },
    },
    { new: true }
  ).exec((error, movie) => {
    if (error) {
      return res.status(500).json(error);
    }
    return res.status(200).json({ success: true, msg: "The Movie has been updated", movie });
  });
});
router.delete(
  "/movie/:movieID",
  authJwtController.isAuthenticated,
  async (req, res) => {
    try {
      const movie = await Movies.findByIdAndDelete(req.params.movieID);
      return res.status(200).json(`${movie.title} has been deleted`);
    } catch (error) {
      return res.status(500).json(error);
    }
  }
);

router.get("/reviews", async (req, res) => {
  try {
    const reviews = await Reviews.find();
    if (!reviews) {
      return res.json(500).json("No Reviews");
    }

    return res.status(200).json(reviews);
  } catch (error) {
    return res.json(500).json(error);
  }
});
router.post("/reviews", authJwtController.isAuthenticated, async (req, res) => {
  const { movie, reviewer, quote, rating } = req.body;
  if (!movie || !reviewer || !quote || !rating) {
    return res.status(500).json({ success: false, msg: "one of the field is missing: " +
          "Title, Username, User Feedback, Rating. Please check the field and try again" });
  }
  try {
    const movieFound = await Movies.findOne({ title: movie });
    if (!movieFound) {
      return res.status(404).json("Sorry! The system could not find the Movie");
    }
    const pastReviews = await Reviews.find({ movie });
    if (pastReviews.length !== 0) {
      const ratings = pastReviews.map((review) => review.rating);
      const avgRating = (
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      ).toFixed(2);
      await movieFound.updateOne({ avgRating });
    } else {
      await movieFound.updateOne({ avgRating: rating });
    }
    Reviews.create(
      {
        movie,
        reviewer,
        quote,
        rating,
      },
      (error, review) => {
        if (error) {
        }
        return res
          .status(200)
          .json({ success: true, msg: "The Review has been created", review });
      }
    );
  } catch (error) {
    res.status(500).json(error);
  }
});

router.post("/search", async (req, res) => {
  try {
    const { searchTerm } = req.body;
    let movies = await Movies.find();

    movies = movies.filter((movie) =>
      movie.title.toLowerCase().includes(searchTerm.toLocaleLowerCase())
    );

    res.status(200).json({ result: movies });
  } catch (error) {
    res.status(500).json(error);
  }
});

app.use("/", router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only
