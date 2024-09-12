const GoogleChartsNode = require('google-charts-node');
//import {GoogleCharts} from 'google-charts';

const {GoogleCharts} = require('google-charts');

const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser');
const ngrok = require('ngrok');
var Promise = require("bluebird");
const imglyRemoveBackground = require("@imgly/background-removal");
const puppeteer = require('puppeteer');



app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



async function render(location) {
  // Puppeteer setup
  const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 2 }; // Your default values
  const browser = await puppeteer.launch({ headless: false, devtools: false });
  //const page = await browser.newPage();

  var [page] = await browser.pages();
  const fullPage = await page.$('body');
  const fullPageSize = await fullPage.boundingBox();
  await page.setViewport(
	  Object.assign({}, VIEWPORT, { height: fullPageSize.height })
  );


  // Add the chart
  await page.setContent(`
<!DOCTYPE html>
<html>
  <head>
    <!---- >
    https://developers.google.com/chart/interactive/docs/gallery/geochart#full
    <!---->
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript" src="https://www.google.com/jsapi"></script>
    <script type="text/javascript">
      google.charts.load('current', {'packages':['geochart'], 'mapsApiKey': 'AIzaSyC30PYKlkRsg6oMTQnsM0MbUhYmHKVwK1c'});
      google.charts.setOnLoadCallback(drawRegionsMap);

      function drawRegionsMap() {

        var data = google.visualization.arrayToDataTable([
          ['State', 'Select'],
          ['${location}', 0],
      	]);

        var options = {
          region: '${location}',
          domain:'US',
          displayMode: 'regions',
          width: 150,
          height: 150,
          resolution: 'provinces',
          keepAspectRatio: true,
          legend: 'none',
          enableRegionInteractivity: false,
          datalessRegionColor: 'transparent',
          defaultColor: 'transparent',
		  colorAxis: {
		      colors: ['#1A1A1A', '#1A1A1A'],
		  },
          backgroundColor: {
            fill: 'transparent',
            stroke: 'transparent',
            strokeWidth: 3
          },
        };

        var container = document.getElementById('geochart');

        var chart = new google.visualization.GeoChart(document.getElementById('geochart'));

          google.visualization.events.addListener(chart, 'ready', function () {
		    // change inactive stroke color
		    var countries = container.getElementsByTagName('path');
		    Array.prototype.forEach.call(countries, function (path) {
		    	if (path.getAttribute('fill') != 'none') {
		    		path.setAttribute('stroke', 'blue');
		    	} else {
					path.setAttribute('stroke', 'transparent');
		    	}
		     
		    });

		    // change active stroke color, build mutation observer
		    var observer = new MutationObserver(function (nodes) {
		      Array.prototype.forEach.call(nodes, function(node) {
		        // check for new nodes
		        if (node.addedNodes.length > 0) {
		          Array.prototype.forEach.call(node.addedNodes, function(addedNode) {
		            // the tooltip element will also be here, we only want the group elements
		            if (addedNode.tagName === 'g') {
		              // find children of the group element
		              Array.prototype.forEach.call(addedNode.childNodes, function(childNode) {
		                // check for path element, change stroke
		                if (childNode.tagName === 'path') {
		                  childNode.setAttribute('stroke', 'transparent');
		                }
		              });
		            }
		          });
		        }
		      });
		    });


		    // activate mutation observer
		    observer.observe(container, {
		      childList: true,
		      subtree: true
		    });
		  });

        chart.draw(data, options);
      }
    </script>
  </head>
  <body>
    <div id="geochart" style="width: 900px; height: 500px;"></div>
  </body>
</html>


  	`, { waitUntil: 'networkidle2' });




  // Use getImageURI if available (not all charts support)
  const imageBase64 = await page.evaluate(() => {
    if (!window.chart || typeof window.chart.getImageURI === 'undefined') {
      return null;
    }
    return window.chart.getImageURI();
  });

  let buf;
  if (imageBase64) {
  	console.log(`getImageURI WAS available`);
    buf = Buffer.from(imageBase64.slice('data:image/png;base64,'.length), 'base64');
  } else {
    // getImageURI was not available - take a screenshot using puppeteer
    console.log(`getImageURI was not available - take a screenshot using puppeteer`);
    
    const element = await page.$('#geochart');

    buf = await element.screenshot({ encoding: "base64" });
  }

  await browser.close();
  return buf;
}



app.get('/map', (req, res) => {

	const data = req.body.location;
	console.log(`Requested map ${data}`);
	var image = null;

	Promise.resolve(render(data)).then(async (result) => {
		image = result;
	

		var encodedBuffer = await result.toString('base64');
		//console.log(`Image has been generated ${encodedBuffer}`);

		// imglyRemoveBackground(encodedBuffer).then((blob) => {
		//   // The result is a blob encoded as PNG. It can be converted to an URL to be used as HTMLImage.src
		//   const url = URL.createObjectURL(blob);

		//   console.log(`Image background has been removed ${url}`);
		// });

		const data = {
		  "result": {
		    "image": `data:image/png;base64, ${encodedBuffer}`
		  }
		}
		res.send(data);
	});
});

app.listen(port, () => {
	console.log(`Listening for map generation requests on port ${port}`);
});
