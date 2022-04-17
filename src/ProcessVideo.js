const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");
const { EventEmitter } = require("events");
const AdmZip = require("adm-zip");
const del = require("del");
const kill = require("tree-kill");
const { fileTypeFromBuffer } = require("file-type");

class ProcessVideo extends EventEmitter {
  tmpDir = "./uploads";
  outDir = "./output";
  ext = "mp4";
  name = "";
  tmpName = "";

  constructor(buff, zipName) {
    super();
    this.zipName = zipName;
    this.generate(buff);
  }

  async generate(buff) {
    try {
      this.name = crypto.randomBytes(10).toString("hex");
      if (!fs.existsSync(this.tmpDir + "/" + this.name)) {
        fs.mkdirSync(this.tmpDir + "/" + this.name, {
          recursive: true,
        });
      }
      if (!fs.existsSync(this.outDir)) {
        fs.mkdirSync(this.outDir, {
          recursive: true,
        });
      }
      const { ext } = await fileTypeFromBuffer(buff);
      this.ext = ext;
      this.tmpName = this.tmpDir + "/" + this.name + "/input" + "." + ext;
      fs.appendFileSync(this.tmpName, Buffer.from(buff));
    } catch (e) {
      this.emit("error", e);
    }
    const child = exec(
      "ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 " +
        this.tmpName,
      (err, out) => {
        if (err) {
          return this.emit("error", err);
        }
        this.totalFrame = Number(out);
        let commands = `bash ./create-vod-hls.sh ${this.tmpName} ${this.tmpDir}/${this.name}/output`;
        if (process.env.NODE_ENV === "production") {
          commands = `bash ./resources/create-vod-hls.sh ${this.tmpName} ${this.tmpDir}/${this.name}/output`;
        }
        exec(commands, (err, stdout) => {
          if (err) {
            return this.emit("error", err);
          }
          this.render(stdout);
        });
      }
    );
    process.on("exit", async () => {
      try {
        kill(child.pid, (err) => {
          console.log("killed", err);
        });
        await del(path.join(this.tmpDir, this.name));
      } catch (e) {
        console.log(e);
      }
    });
  }

  render(commands) {
    const child = exec(commands);
    child.stderr.on("data", (data) => this.onData(data));
    child.stdout.on("data", (data) => this.onData(data));
    child.on("close", (code) => {
      if (code !== 0) {
        return this.emit("error", new Error("Failed to render video."));
      }
      this.zipRenderedVideo();
    });

    process.on("exit", async () => {
      try {
        kill(child.pid, (err) => {
          console.log("killed", err);
        });
        await del(path.join(this.tmpDir, this.name));
      } catch (e) {
        console.log(e);
      }
    });
  }

  onData(data) {
    const arr = data
      .toString()
      .split(" ")
      .map((el) => el.trim())
      .filter((el) => !!el);
    if (arr[0] == "frame=") {
      this.emit("progress", {
        total: this.totalFrame,
        current: Number(arr[1]),
      });
    }
  }

  zipRenderedVideo() {
    const zip = new AdmZip();
    zip.addLocalFolder(path.join(this.tmpDir, this.name + "/output"));
    zip.writeZip(this.zipName, async (err) => {
      if (err) {
        return this.emit("error", err);
      }
      await del(path.join(this.tmpDir, this.name));
      this.emit("end");
    });
  }
}

module.exports = ProcessVideo;
