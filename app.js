let paymentHistory =
JSON.parse(
  localStorage.getItem("paymentHistory")
) || [];

let archives =
JSON.parse(localStorage.getItem("archives")) || [];


function renderAnalytics(){

  if(!archives.length) return;

  const best = archives.reduce(
    (a,b)=>
    b.collected > a.collected
      ? b
      : a
  );

  const avg =
  archives.reduce(
    (sum,a)=>
    sum + a.collected,
    0
  ) / archives.length;

  $("bestMonth").innerText =
    best.month;

  $("highestCollection").innerText =
    "₱" +
    best.collected.toLocaleString();

  $("averageCollection").innerText =
    "₱" +
    Math.round(avg).toLocaleString();
}
// ================= SAFE STORAGE =================
function loadStudents(){
  try{
    return JSON.parse(localStorage.getItem("students")) || [];
  }catch{
    return [];
  }
}

let students = loadStudents();
let startDate = localStorage.getItem("startDate") || null;
let skippedWeeks =
JSON.parse(localStorage.getItem("skippedWeeks")) || [];
let lastImportedStudentIds =
JSON.parse(localStorage.getItem("lastImportedStudentIds")) || [];

const WEEKLY_FEE = 5;



// ================= SAFE HELPERS =================
function $(id){ return document.getElementById(id); }

function toNumber(v){
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ================= SAVE =================
function save(){
  localStorage.setItem("students", JSON.stringify(students));
  localStorage.setItem("skippedWeeks", JSON.stringify(skippedWeeks));
}

// ================= SETTINGS =================
function saveSettings(){

  startDate = $("startDate").value;

  localStorage.setItem(
    "startDate",
    startDate
  );

  renderCalendar();
  render();
}



// ================= WEEK =================
function getCurrentWeek(){

 

  if(!startDate) return 1;

  const start = new Date(startDate);
  const today = new Date();

  start.setHours(0,0,0,0);
  today.setHours(0,0,0,0);

  let weekdays = 0;

  const current = new Date(start);

  while(current <= today){

    const day = current.getDay();

    if(day !== 0 && day !== 6){
      weekdays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return Math.max(1, Math.ceil(weekdays / 5));
}

// ================= ADD STUDENT =================
function addStudent(){

  const name = $("studentName")?.value?.trim();
  if(!name) return;

  students.push({
    id: Date.now(),
    name,
    payments:[]
  });

  $("studentName").value = "";
  save();
  render();
}

function cleanImportedStudentName(line){
  return line
    .replace(/\b(MALE|FEMALE)\b/gi, " ")
    .replace(/\b(NO|NAME|STUDENT|STUDENTS|CLASS|SECTION|LIST|GRADE)\b/gi, " ")
    .replace(/^[\s\d.)-]+/g, "")
    .replace(/[^\p{L}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportedText(text){
  return text
    .replace(/[|]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\t/g, "  ");
}

function splitNumberedStudentLine(line){
  const normalized = line
    .replace(/([A-Za-z])(\d{1,2}\s+[A-Z])/g, "$1 $2")
    .trim();

  const parts = normalized
    .split(/\s+(?=\d{1,2}[\s.)-]+[A-Z])/g)
    .map(part => part.trim());

  return parts.length ? parts : [line];
}

function looksLikeStudentName(name){
  const lowered = name.toLowerCase();
  const ignoredWords = new Set([
    "male",
    "female",
    "name",
    "student",
    "students",
    "class",
    "section",
    "list",
    "grade",
    "no",
    "number"
  ]);

  if(!name || name.length < 4) return false;
  if(ignoredWords.has(lowered)) return false;
  if(!/[a-z]/i.test(name)) return false;
  if(name.split(" ").length > 7) return false;
  if(/^\W+$/.test(name)) return false;

  return true;
}

function getImportedNames(text){
  const seen = new Set();
  const names = [];

  normalizeImportedText(text)
    .split(/\r?\n/)
    .flatMap(splitNumberedStudentLine)
    .map(cleanImportedStudentName)
    .filter(looksLikeStudentName)
    .forEach(name => {
      const key = name.toLowerCase();

      if(seen.has(key)) return;

      seen.add(key);
      names.push(name);
    });

  return names;
}

function setImportPreview(names){
  const preview = $("importPreview");
  const previewBox = $("importPreviewBox");

  if(!preview || !previewBox) return;

  preview.value = names.join("\n");
  previewBox.classList.toggle("show", names.length > 0);
}

function clearStudentImportPreview(){
  const preview = $("importPreview");
  const previewBox = $("importPreviewBox");
  const status = $("importStatus");

  if(preview) preview.value = "";
  if(previewBox) previewBox.classList.remove("show");
  if(status) status.innerText = "Ready to scan a student list.";
}

function addImportedStudents(names){
  const existing = new Set(
    students.map(s => (s.name || "").trim().toLowerCase())
  );

  const uniqueNames = [];
  const importedIds = [];

  names.forEach(name => {
    const key = name.toLowerCase();

    if(existing.has(key)) return;

    existing.add(key);
    uniqueNames.push(name);
  });

  uniqueNames.forEach((name,index) => {
    const id = Date.now() + index;

    students.push({
      id,
      name,
      payments:[]
    });

    importedIds.push(id);
  });

  if(uniqueNames.length){
    lastImportedStudentIds = importedIds;
    localStorage.setItem(
      "lastImportedStudentIds",
      JSON.stringify(lastImportedStudentIds)
    );

    save();
    render();
  }

  return uniqueNames.length;
}

async function importStudentsFromImage(event){
  const file = event.target.files?.[0];
  const status = $("importStatus");

  if(!file) return;

  if(!window.Tesseract){
    if(status){
      status.innerText = "OCR library is still loading. Please try again in a moment.";
    }
    return;
  }

  try{
    if(status){
      status.innerText = "Scanning image... this can take a few seconds.";
    }

    const result = await Tesseract.recognize(file, "eng", {
      logger(progress){
        if(!status || progress.status !== "recognizing text") return;

        const percent = Math.round((progress.progress || 0) * 100);
        status.innerText = `Reading names... ${percent}%`;
      }
    });

    const names = getImportedNames(result.data.text || "");

    setImportPreview(names);

    if(status){
      status.innerText = names.length
        ? `Found ${names.length} possible name${names.length === 1 ? "" : "s"}. Review them below, then import.`
        : "No names found. Try cropping only the student list or using a clearer image.";
    }
  }catch(error){
    console.error(error);

    if(status){
      status.innerText = "Could not scan this image. Try a clearer photo or screenshot.";
    }
  }finally{
    event.target.value = "";
  }
}

function confirmStudentImport(){
  const preview = $("importPreview");
  const status = $("importStatus");

  if(!preview) return;

  const names = getImportedNames(preview.value);
  const added = addImportedStudents(names);

  if(status){
    status.innerText = added
      ? `Added ${added} reviewed student${added === 1 ? "" : "s"}.`
      : "No new students added. They may already exist or the preview is empty.";
  }

  if(added){
    clearStudentImportPreview();
  }
}

function undoLastStudentImport(){
  const status = $("importStatus");

  if(!lastImportedStudentIds.length){
    if(status){
      status.innerText = "There is no recent import to undo.";
    }
    return;
  }

  const ids = new Set(lastImportedStudentIds);
  const before = students.length;

  students = students.filter(student => !ids.has(student.id));
  lastImportedStudentIds = [];

  localStorage.setItem(
    "lastImportedStudentIds",
    JSON.stringify(lastImportedStudentIds)
  );

  save();
  render();

  const removed = before - students.length;

  if(status){
    status.innerText = removed
      ? `Removed ${removed} student${removed === 1 ? "" : "s"} from the last import.`
      : "No matching students from the last import were found.";
  }
}

// ================= ADD PAYMENT =================
function addPayment(){

  const id = toNumber($("studentSelect")?.value);
  const amount = toNumber($("paymentAmount")?.value);

  if(!id || amount <= 0) return;

  const s = students.find(x=>x.id===id);
  if(!s) return;

  const now = new Date();

s.payments.push({
  amount,
  date: now.toLocaleString(),
  month: now.toLocaleString("en-US",{
    month:"long",
    year:"numeric"
  })
});

  $("paymentAmount").value = "";
  save();
  render();
}

// ================= COMPUTE =================
function getTotal(s){
  return (s.payments||[]).reduce((a,b)=>a + toNumber(b.amount),0);
}

function getWeeks(total){
  return Math.floor(total / WEEKLY_FEE);
}

function getDebt(weeks){

  const cur = getCurrentWeek();

  let validWeeks = 0;

  for(let i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }

  const debtWeeks = validWeeks - weeks;

  return Math.max(0, debtWeeks * WEEKLY_FEE);
}

// ================= DELETE =================
function deleteStudent(id){
  students = students.filter(s=>s.id!==id);
  save();
  render();
}

function deletePayment(id,i){
  const s = students.find(x=>x.id===id);
  if(!s) return;

  s.payments.splice(i,1);
  save();
  render();
}

// ================= EDIT PAYMENT =================
function editPayment(studentId,index){

  const s = students.find(x=>x.id===studentId);
  if(!s || !s.payments[index]) return;

  const newAmount = prompt("Edit payment:", s.payments[index].amount);

  const num = Number(newAmount);
  if(newAmount === null || isNaN(num)) return;

  s.payments[index].amount = num;

  save();
  render();
}

// ================= ANIMATION =================
function animateNumber(el,target){

  if(!el) return;

  target = toNumber(target);

  let start = performance.now();

  function run(now){
    let p = Math.min((now-start)/800,1);
    let val = Math.floor(p*target);

    el.innerText = "₱" + val.toLocaleString();

    if(p<1) requestAnimationFrame(run);
    else el.innerText = "₱" + target.toLocaleString();
  }

  requestAnimationFrame(run);
}

// ================= RENDER =================
function render(){

  const tbody = $("studentTable");
  if(!tbody) return;

  tbody.innerHTML = "";

  const search = ($("searchInput")?.value || "").toLowerCase();
  const cur = getCurrentWeek();

  let totalCollected = 0;
  let updated = 0;
  let advanced = 0;

  const filtered = students.filter(s =>
    (s.name||"").toLowerCase().includes(search)
  );

  filtered.forEach(s=>{

    const total = getTotal(s);
    const weeks = getWeeks(total);
    const debt = getDebt(weeks);

    totalCollected += total;

    if(weeks===cur) updated++;
    if(weeks>cur) advanced++;

    let history = "";

    (s.payments||[]).forEach((p,i)=>{
      history += `
        ₱${p.amount}
        <button onclick="editPayment(${s.id},${i})">✏</button>
        <button onclick="deletePayment(${s.id},${i})">🗑</button><br>
      `;
    });

    tbody.innerHTML += `
      <tr>
        <td><button onclick="viewStudent(${s.id})">${s.name}</button></td>
        <td>₱${total}</td>
        <td>${weeks}</td>
        <td>₱${debt}</td>
        <td>${weeks>=cur?"OK":"DEBT"}</td>
        <td>${history}</td>
        <td><button onclick="deleteStudent(${s.id})">Delete</button></td>
      </tr>
    `;
  });

  let validWeeks = 0;

for(let i = 1; i <= cur; i++){
  if(!isSkipped(i)) validWeeks++;
}

const expected =
validWeeks * WEEKLY_FEE * students.length;

  // ================= EXISTING DASHBOARD =================
  animateNumber($("collected"), totalCollected);
  animateNumber($("expected"), expected);
  animateNumber($("remaining"), Math.max(0,expected-totalCollected));

  $("studentCount").innerText = students.length;
  $("updatedCount").innerText = updated;
  $("advancedCount").innerText = advanced;

  // ================= 🔥 ADDED FEATURE (NO REMOVAL) =================
  const eventFund = totalCollected * 0.70;
  const reserveFund = totalCollected * 0.30;

  animateNumber($("eventFund"), eventFund);
  animateNumber($("reserveFund"), reserveFund);

  
  renderSelect();

saveArchive();

renderArchive();

if(typeof renderAnalytics === "function"){
  renderAnalytics();
}
}

// ================= DROPDOWN =================
function renderSelect(){

  const sel = $("studentSelect");
  if(!sel) return;

  sel.innerHTML = "";

  students.forEach(s=>{
    sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

function payAll(amount){

  amount = Number(amount);

  if(!amount || amount <= 0) return;

  const date = new Date().toLocaleString();

  students.forEach(student => {
    student.payments.push({
      amount,
      date
    });
  });

  save();
  render();

  console.log(`Added ₱${amount} to ${students.length} students`);
}

function resetAllPayments(){

  const confirmReset = confirm(
    "WARNING: Delete ALL payment records?"
  );

  if(!confirmReset) return;

  students.forEach(student => {
    student.payments = [];
  });

  save();
  render();

  console.log("All payments reset successfully.");
}

function skipWeek(week){

  week = Number(week);

  if(!week || skippedWeeks.includes(week))
    return;

  skippedWeeks.push(week);

  save();

  render();
  renderCalendar();
}

function isSkipped(week){
  return skippedWeeks.includes(week);
}

function unskipWeek(week){

  week = Number(week);

  skippedWeeks = skippedWeeks.filter(
    w => w !== week
  );

  save();

  render();
  renderCalendar();

  console.log("Unskipped week:", week);
}

  




function copyReport(){

  if(!students) return;

  let totalCollected = 0;
  let debtCount = 0;
  let advancedCount = 0;
  let updatedCount = 0;

  students.forEach(s => {

    const totalPaid = getTotal(s);
    const weeks = getWeeks(totalPaid);
    const debt = getDebt(weeks);

    totalCollected += totalPaid;

    if(debt > 0) debtCount++;
    if(weeks > getCurrentWeek()) advancedCount++;
    if(weeks === getCurrentWeek()) updatedCount++;
  });

  const cur = getCurrentWeek();

let validWeeks = 0;

for(let i = 1; i <= cur; i++){
  if(!isSkipped(i)) validWeeks++;
}

const expected = validWeeks * WEEKLY_FEE * students.length;
const remaining = expected - totalCollected;

  const report = `
📊 CLASS FUND REPORT

📅 Current Week: ${cur}
👥 Students: ${students.length}

💰 Total Collected: ₱${totalCollected}
🎯 Expected: ₱${expected}
📉 Remaining: ₱${remaining}

✅ Updated: ${updatedCount}
⚠ With Debt: ${debtCount}
⭐ Advanced: ${advancedCount}

🕒 Generated: ${new Date().toLocaleString()}
`;

  navigator.clipboard.writeText(report)
    .then(()=> alert("nakopya na po. salamat ha :D"))
    .catch(()=> alert("Copy failed"));
}

function exportBackup(){

  const data = {
    students: students || [],
    startDate: startDate || null
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "class-fund-backup.json";
  a.click();

  URL.revokeObjectURL(url);
}

function showPage(page){

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.remove("active");
  });

  const selectedPage =
  document.getElementById("page-" + page);

  if(selectedPage){
    selectedPage.classList.add("active");
  }

  document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.classList.remove("active");
  });

  if(page === "history"){
    renderHistory();
  }

  if(page === "archive"){
    renderArchive();
  }

  if(page === "analytics"){
    renderAnalytics();
  }
}



function renderCalendar(){

  const container = $("calendarWeeks");

  if(!container) return;

  if(!startDate){

    container.innerHTML = `
      <p>
        Select a first collection date first.
      </p>
    `;

    return;
  }

  const start = new Date(startDate);

  let html = "";

  for(let i=1;i<=5;i++){

    const weekStart = new Date(start);
    weekStart.setDate(
      start.getDate() + ((i-1)*7)
    );

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(
      weekStart.getDate() + 4
    );

    html += `
<div class="card">

  <strong>
    Week ${i}
  </strong>

  <br>

  ${weekStart.toLocaleDateString()}
  -
  ${weekEnd.toLocaleDateString()}

  <br><br>

  <span>
    ${
      isSkipped(i)
      ? "🚫 Skipped"
      : "✅ Active"
    }
  </span>

  <br><br>

  ${
    isSkipped(i)
    ?
    `<button onclick="unskipWeek(${i})">
      Remove Skip
    </button>`
    :
    `<button onclick="skipWeek(${i})">
      Skip Week
    </button>`
  }

</div>
`;
  }

  container.innerHTML = html;
}


function saveArchive(){

  const today = new Date();

  const monthKey =
  today.toLocaleString("en-US",{
    month:"long",
    year:"numeric"
  });

  const totalCollected = students.reduce(
    (sum,s)=>sum+getTotal(s),
    0
  );

  const archive = {
    month: monthKey,
    collected: totalCollected,
    eventFund: totalCollected * 0.70,
    reserveFund: totalCollected * 0.30,
    students: students.length,
    date: new Date().toLocaleString()
  };

  const existing =
  archives.find(a=>a.month===monthKey);

  if(existing){

    existing.collected =
    archive.collected;

    existing.eventFund =
    archive.eventFund;

    existing.reserveFund =
    archive.reserveFund;

    existing.students =
    archive.students;

    existing.date =
    archive.date;

  }else{

    archives.push(archive);

  }

  localStorage.setItem(
    "archives",
    JSON.stringify(archives)
  );

}

function renderArchive(){

  const container =
  document.getElementById("archiveContainer");

  if(!container) return;

  container.innerHTML = "";

  if(archives.length === 0){

    container.innerHTML = `
      <div class="card">
        No archived months yet.
      </div>
    `;

    return;
  }

  archives
  .slice()
  .reverse()
  .forEach(a=>{

    container.innerHTML += `
      <div class="card">
        <h3>${a.month}</h3>

        <p>💰 Collected: ₱${a.collected}</p>
        <p>🎉 Event Fund: ₱${a.eventFund}</p>
        <p>🏦 Reserve Fund: ₱${a.reserveFund}</p>
        <p>👥 Students: ${a.students}</p>

        <small>${a.date}</small>
      </div>
    `;
  });

}


function renderHistory(){

  const container =
  $("historyContainer");

  if(!container) return;

  const search =
  ($("historySearch")?.value || "")
  .toLowerCase();

  let html = "";

  paymentHistory.forEach(record=>{

    if(
      !record.student
      .toLowerCase()
      .includes(search)
    ) return;

    html += `
    <div class="card">

      <strong>
        ${record.student}
      </strong>

      <p>
        💰 ₱${record.amount}
      </p>

      <p>
        📅 ${record.date}
      </p>

      <p>
        📁 ${record.month}
      </p>

    </div>
    `;
  });

  container.innerHTML =
  html ||
  `<div class="card">
    No payment records found.
  </div>`;
}

function checkMonthReset(){

  const currentMonth =
  new Date().toLocaleString("en-US",{
    month:"long",
    year:"numeric"
  });

  const savedMonth =
  localStorage.getItem("currentMonth");

  if(!savedMonth){

    localStorage.setItem(
      "currentMonth",
      currentMonth
    );

    return;
  }

  if(savedMonth === currentMonth){
    return;
  }

  // Save old payments to permanent history
  students.forEach(student=>{

    student.payments.forEach(payment=>{

      paymentHistory.push({

        student: student.name,

        amount: payment.amount,

        date: payment.date,

        month:
        payment.month ||
        savedMonth

      });

    });

    // Reset monthly payments
    student.payments = [];

  });

  skippedWeeks = [];

  localStorage.setItem(
    "paymentHistory",
    JSON.stringify(paymentHistory)
  );

  localStorage.setItem(
    "skippedWeeks",
    JSON.stringify([])
  );

  localStorage.setItem(
    "currentMonth",
    currentMonth
  );

  save();

  alert(
    "New month detected. Monthly collections have been reset."
  );
}
function viewStudent(id){

  const student =
  students.find(s => s.id === id);

  if(!student) return;

  const total =
  getTotal(student);

  const weeks =
  getWeeks(total);

  const debt =
  getDebt(weeks);

  let payments = "";

  student.payments.forEach(p=>{

    payments += `
      <li>
        ₱${p.amount}
        -
        ${p.date}
      </li>
    `;

  });

  $("studentInfo").innerHTML = `
    <h2>${student.name}</h2>

    <p>
      💰 Total Paid:
      ₱${total}
    </p>

    <p>
      📅 Weeks Covered:
      ${weeks}
    </p>

    <p>
      ⚠ Debt:
      ₱${debt}
    </p>

    <h3>Payments</h3>

    <ul>
      ${payments || "<li>No payments yet</li>"}
    </ul>
  `;

  $("studentModal").style.display =
  "flex";
}

function closeModal(){

  $("studentModal").style.display =
  "none";

}
// ================= INIT =================
window.onload = () => {

  if($("startDate")){
    $("startDate").value = startDate || "";
  }

  renderHistory();
  renderSelect();
  renderCalendar();
  renderArchive();
  renderAnalytics();
  checkMonthReset();
  render();

  showPage("dashboard");
};
console.log("Students Loaded:", students);
