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

// ================= SAFE HELPERS =================
function $(id){ return document.getElementById(id); }

function toNumber(v){
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ================= SAVE =================
function save(){
  localStorage.setItem("students", JSON.stringify(students));
}

// ================= SETTINGS =================
function saveSettings(){
  startDate = $("startDate").value;
  localStorage.setItem("startDate", startDate);
  render();
}

// ================= WEEK =================
function getCurrentWeek(){
  if(!startDate) return 1;

  const start = new Date(startDate);
  const now = new Date();

  const diff = now - start;
  const days = Math.floor(diff / (1000*60*60*24));

  return Math.max(1, Math.floor(days / 7) + 1);
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

// ================= ADD PAYMENT =================
function addPayment(){

  const id = toNumber($("studentSelect")?.value);
  const amount = toNumber($("paymentAmount")?.value);

  if(!id || amount <= 0) return;

  const s = students.find(x=>x.id===id);
  if(!s) return;

  s.payments.push({
    amount,
    date:new Date().toLocaleString()
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
  return Math.floor(total / 10);
}

function getDebt(weeks){
  const cur = getCurrentWeek();
  return Math.max(0,(cur-weeks)*10);
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
        <td>${s.name}</td>
        <td>₱${total}</td>
        <td>${weeks}</td>
        <td>₱${debt}</td>
        <td>${weeks>=cur?"OK":"DEBT"}</td>
        <td>${history}</td>
        <td><button onclick="deleteStudent(${s.id})">Delete</button></td>
      </tr>
    `;
  });

  const expected = cur * 10 * students.length;

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

// ================= INIT =================
render();