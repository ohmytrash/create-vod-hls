import "./index.css";

const input = document.getElementById("input");
const message = document.getElementById("message");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

let fileName;

input.addEventListener("change", (e) => {
  e.preventDefault();
  const file = e.target.files[0];
  clear();
  if (file) {
    input.disabled = true;
    fileName = file.name;
    message.innerText = "VALIDATING - " + fileName;
    file.arrayBuffer().then((arrayBuffer) => {
      window.api.processVideo({
        arrayBuffer,
        fileName,
      });
    });
  }
});

window.api.on("progress", (data) => {
  message.innerText = `CONVERTING - "${fileName}" : ${data.current}/${
    data.total
  } - ${((data.current / data.total) * 100).toFixed()}%`;
});
window.api.on("error", (error) => {
  clear();
  console.log(error);
  errorMessage.innerText = error.message;
});
window.api.on("end", () => {
  clear();
  successMessage.innerText = "Successfully to convert : " + fileName;
});

function clear() {
  input.value = null;
  input.disabled = false;
  message.innerText = "DROP VIDEO HERE OR CLICK";
  errorMessage.innerText = "";
  successMessage.innerText = "";
}
