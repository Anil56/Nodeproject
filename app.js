const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const csv = require('csvtojson')
const app = express()
const moment = require('moment')

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";
let db;
MongoClient.connect(url, function(err, database) {
    if (err) throw err;
    console.log("Database Connected!");
    db = database.db("NOD");
});
// create application/json parser
const jsonParser = bodyParser.json();

// create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const port = 8000;

app.use(urlencodedParser);

app.get('/', (req, res) => {
    res.send('Hello World!')
});

const extract = require('extract-zip')
const fs = require('fs')

async function downloadCSVZIP(fileName) {
    try {
        let apires = await axios({
            method: 'get',
            url: `http://www.bseindia.com/download/BhavCopy/Equity/EQ${fileName}_CSV.ZIP`,
            responseType: 'stream',
        })
        const writer = fs.createWriteStream(`./BSEZIP/${fileName}.zip`);

        return new Promise((resolve, reject) => {
            apires.data.pipe(writer);
            let error = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on('close', () => {
                if (!error) {
                    resolve(true);
                }

            });
        });
    } catch (err) {
        console.log({ err });
    }
}

app.get('/getStock', async function(req, res) {
    // Check if Date is Valid
    let finalResponse = {
        success: true,
        message: ''
    };
    let dFormat = "DDMMYY"
    let data = req.query;
    let startDateCSV = data.startDate;

    let isValidS = moment().isValid(data.startDate);
    let isValidE = moment().isValid(data.endDate);

    if (!data.startDate || !data.endDate || !isValidS || !isValidE) {
        finalResponse.message = 'Invalid Dates Provided'
        finalResponse.success = false;
        res.send(finalResponse);
        return
    }
    let formatS = moment(data.startDate, dFormat);
    let formatE = moment(data.endDate, dFormat);

    if (!formatE._isValid || !formatS._isValid) {
        finalResponse.message = 'Invalid Dates Format. Date format required as ' + dFormat
        finalResponse.success = false;
        res.send(finalResponse);
        return
    }
    let isValiddiffe = moment().diff(moment(data.endDate, dFormat))
    let isValiddiffs = moment().diff(moment(data.startDate, dFormat))
    if (!isValiddiffe || !isValiddiffs) {
        finalResponse.message = 'Invalid Date'
        finalResponse.success = false;
        res.send(finalResponse);
        return
    }


    var dates = [];

    var currDate = moment(data.startDate, dFormat);
    var lastDate = moment(data.endDate, dFormat);

    do {
        if (currDate.weekday())
            dates.push(currDate.clone().format(dFormat));
    } while (currDate.add(1, 'days').diff(lastDate) <= 0);
    dates.push(lastDate.clone().format(dFormat));
    for (let iti = 0; iti < dates.length; iti++) {
        const date = dates[iti];
        if (data.isISIN) {
            startDateCSV = `_ISINCODE_${date}`
        } else {
            startDateCSV = `${date}`
        }
        let response = await downloadCSVZIP(startDateCSV);
        if (response == true) {
            try {
                await extract(`${__dirname}/BSEZIP/${startDateCSV}.zip`, { dir: `${__dirname}/BSEZIP` })
            } catch (error) {
                console.log({ error });
            }
            csv()
                .fromFile(`${__dirname}/BSEZIP/EQ${startDateCSV}.csv`)
                .then(async (jsonObj) => {
                    for (let opo = 0; opo < jsonObj.length; opo++) {
                        var row = jsonObj[opo];
                        var stock = { ...row, created };
                        var payload = {
                            $set: {
                                "SC_CODE": `${row.SC_CODE}`,
                            }
                        }

                        payload.$set[`stocks.${date}`] = { ...stock };
                        await db.collection("BSEINDIA").update({ 'SC_CODE': `${row.SC_CODE}` }, payload, { upsert: true })
                    }
                })
        }
    }
    res.send(finalResponse)
});


app.get('/getProfit', async function(req, res) {
    let data = req.query;

    if (!data.code || typeof data.code != 'int') {
        // res.send({ status: false, message: 'Invalid Input' })
    }

    let stock = await db.collection("BSEINDIA").findOne({ SC_CODE: data.code });
    console.log({ stock: stock });
    res.send("success");
})
function factorial(n) {
    let answer = 1;
    if (n == 0 || n == 1) {
        return answer;
    } else {
        for (var i = n; i >= 1; i--) {
            answer = answer * i;
            console.log({ answer: answer });
        }
        return answer;
    }
}
let n = 3;
answer = factorial(n)
console.log("The factorial of " + n + " is " + answer);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`)
});