const https = require('https');
const rl = require('readline').createInterface({input: process.stdin, output: process.stdout});
const fs = require('fs');
const util = require("util");
const exec = util.promisify(require('child_process').exec);

main();

async function main () {

  try {
    await exec("mkdir media")
  } catch(e) {
    // media folder already exists
  }

  const censored = {
    host: "censored.tv",
    port: 443,
    path: "/shows",
    method: "GET"
  };
  const shows_json_page = await fetch_page(censored);
  let shows = [... new Set(JSON.parse(shows_json_page))];

  const show_pick = await list_and_pick(shows.map(function(it) {return it.title}));
  let show_episodes = await get_episodes(shows[show_pick].id);

  for (let last_ep = 0; last_ep < show_episodes.length; last_ep++) {

    let ep_path = show_episodes[last_ep].local_media;
    const ep_name = show_episodes[last_ep].title;
    console.log("DOWNLOADING: " + ep_name + " ", last_ep, "\n");
    
    if (show_episodes[last_ep].published == 0) continue;

    if (
      !fs.existsSync("media/" + ep_name + ".mp4")
    ) {

      if (ep_path != null) await dl_ep_from_google_storage(ep_path, ep_name);
      else if (show_episodes[last_ep].stream_url != null) {
        ep_path = show_episodes[last_ep].stream_url;
        await dl_ep_from_aws_streaming(ep_path, ep_name);
      }
      else console.log("CANT DOWNLOAD EP :" + ep_name + " NO RESOURCE LINK");
    }

  }

  console.log('DOWNLOADED THE WHOLE CATALOG');
  return;

}

async function get_episodes(id) {
  const show = {
    host: "censored.tv",
    port: 443,
    path: "/shows/" + id + "/episodes",
    method: "GET"
  }

  const page_plain_json = await fetch_page(show);
  return Array.from(JSON.parse(page_plain_json));
}

async function dl_ep_from_google_storage (ep_path, ep_name) {

  const path = 'media/' + ep_name + '.mp4';

  try {
    await exec('ffmpeg -i \"' + ep_path + '\" -c:v libx264 -preset slow -crf 22 \"' + path + '\"');
  } catch (e) {
    console.error("CANT DOWNLOAD EP: " + ep_name);
  }

}

async function dl_ep_from_aws_streaming (ep_path, ep_name) {

  //ep_path is the path to the master.m3u8 file, we assume a 1080p version exists and download that.
  // we could check the best version inside the master but im lazy
  ep_path = ep_path.replace("master.m3u8", "1080.m3u8");
  const path = 'media/' + ep_name + '.mp4';

  try {
    await exec('ffmpeg -i \"' + ep_path + '\" -c:v libx264 -preset slow -crf 22 \"' + path + '\"');
  } catch (e) {
    console.error("CANT DOWNLOAD EP: " + ep_name);
  }
}

function list_and_pick (arr) {
  for (let i = 0; i < arr.length; i++) {
    console.log((i + "").padEnd(2) +": ", arr[i], "\n");
  }
  const pick_prom = new Promise(function (res, rej) {

    rl.question("pick 0 - " + (arr.length - 1) + "\n", function(pick) {
      if (+pick >= arr.length) res(list_and_pick(arr));
      else res(+pick);
    });
  }); 
  return pick_prom;
}

function fetch_page(page) {

  let data = "";
  const prom = new Promise(function(resolve, reject) {

    const req = https.request(page, function (res) {

      res.setEncoding('utf-8');
      res.on("error", reject);
      res.on("data", function(chunk) {
        data += chunk;
      });
      res.on("end", function(){
        resolve(data);
      });
    });
    req.end();
  });
  return prom;
}
