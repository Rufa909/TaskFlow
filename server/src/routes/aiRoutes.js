const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/chat", async (req, res) => {

  try {

    const response = await axios.post(
      "http://localhost:5001/ai",
      {
        message: req.body.message
      }
    );

    res.json(response.data);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "AI service error"
    });
  }
});

module.exports = router;