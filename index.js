require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const dns = require("dns");
const assert = require('assert');


// Basic Configuration
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri);

const shortedUrlSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number
})
const shortedUrl = mongoose.model("shortedUrl", shortedUrlSchema);

const nextShortSchema = new mongoose.Schema({ next_short: Number });
const nextShort = mongoose.model("nextShort", nextShortSchema);



app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(`${process.cwd()}/public`));
app.use("/", (req, res, next) => {
  console.log(req.method, req.path, req.body, req.ip,);
  next();
})

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', async function (req, res) {
  res.json({ greeting: 'hello API' });
});

async function initShorts() {
  // check if the next short url is defined or not
  if (! await nextShort.findOne({})) {
    try {
      const initNext = new nextShort({ next_short: 0 });
      initNext.save();
    } catch (err) {
      console.error(err);
    }
  }

  console.log((await nextShort.findOne({})).get("next_short"))
}
initShorts();

async function insertUrl(url) {
  // get the next sort url and update the currant one
  let short = (await nextShort.findOneAndUpdate({}, { $inc: { next_short: 1 } })).get("next_short")
  const shortUrl = new shortedUrl({
    original_url: url,
    short_url: short
  });
  await shortUrl.save();
  return shortUrl
}


app.use("/api/shorturl/:shorturl?", async (req, res) => {
  // retrieve to original url using the sort url
  if (req.params.shorturl && req.method === "GET") {
    let url = await shortedUrl.findOne({ short_url: Number(req.params.shorturl) });
    let originalUrl = url.get("original_url")
    res.writeHead(301, {
      Location: originalUrl
    }).end();
    return "Ok";
  }

  let original_url = req.body.url;

  try {
    // validate the url
    let originalUrl = new URL(original_url);
    assert(originalUrl.protocol === "http:" || originalUrl.protocol === "https:")
  }
  catch {
    res.json({ error: "invalid url" });
    return;

  };

  let shortUrlObject = await shortedUrl.findOne({ original_url }).exec();
  if (!shortUrlObject) {
    shortUrlObject  = await insertUrl(original_url);
  }

  let short_url = shortUrlObject.get("short_url");

  res.json({
    original_url,
    short_url
  })

})

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});