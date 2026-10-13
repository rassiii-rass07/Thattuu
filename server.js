const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "local-demo-secret-change-before-deploy";
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, "thattu.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','restaurant','delivery','admin')),
  phone TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cuisine TEXT NOT NULL,
  description TEXT DEFAULT '', rating REAL DEFAULT 4.2, delivery_minutes INTEGER DEFAULT 30,
  delivery_fee INTEGER DEFAULT 30, is_open INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL, description TEXT DEFAULT '', price INTEGER NOT NULL,
  category TEXT DEFAULT 'Popular', is_veg INTEGER DEFAULT 1, available INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES users(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), delivery_id INTEGER REFERENCES users(id),
  items_json TEXT NOT NULL, subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL,
  tax INTEGER NOT NULL, total INTEGER NOT NULL, payment_method TEXT NOT NULL DEFAULT 'COD',
  status TEXT NOT NULL DEFAULT 'Placed',
  address TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const userCount = db.prepare("SELECT COUNT(*) n FROM users").get().n;
if (userCount === 0) {
  const addUser = db.prepare("INSERT INTO users(name,email,password_hash,role,phone) VALUES(?,?,?,?,?)");
  for (const u of [
    ["Thattu Admin","admin@thattu.demo","AdminDemo!2026","admin","9000000001"],
    ["Demo Restaurant","restaurant@thattu.demo","RestaurantDemo!2026","restaurant","9000000002"],
    ["Demo Delivery Partner","delivery@thattu.demo","DeliveryDemo!2026","delivery","9000000003"],
    ["Demo Customer","customer@thattu.demo","CustomerDemo!2026","customer","9000000004"]
  ]) addUser.run(u[0],u[1],bcrypt.hashSync(u[2],10),u[3],u[4]);
}
if (db.prepare("SELECT COUNT(*) n FROM restaurants").get().n === 0) {
  const addR = db.prepare("INSERT INTO restaurants(name,cuisine,description,rating,delivery_minutes,delivery_fee) VALUES(?,?,?,?,?,?)");
  const ids = [
    addR.run("Madras Tiffin House","South Indian","Idli, dosa and classic breakfast",4.5,20,25).lastInsertRowid,
    addR.run("Anjappar Biryani Corner","Biryani","Aromatic biryani and spicy sides",4.4,35,35).lastInsertRowid,
    addR.run("Wok & Roll","Chinese","Noodles, fried rice and quick bites",4.1,30,30).lastInsertRowid,
    addR.run("Amma Veetu Saapadu","Meals","Homestyle meals and comfort food",4.6,25,20).lastInsertRowid,
    addR.run("Burger Junction","Fast Food","Burgers, fries and wraps",4.0,25,30).lastInsertRowid,
    addR.run("Sweet Spot","Desserts","Traditional sweets and desserts",4.3,25,20).lastInsertRowid
  ];
  const addM = db.prepare("INSERT INTO menu_items(restaurant_id,name,description,price,category,is_veg) VALUES(?,?,?,?,?,?)");
  const menu = [
    [0,"Mini Idli Sambar","Soft mini idlis with sambar",90,"Tiffin",1],[0,"Ghee Roast Dosa","Crispy dosa with chutneys",120,"Tiffin",1],[0,"Pongal","Pepper pongal with chutney",85,"Tiffin",1],
    [1,"Chicken Biryani","Seeraga samba rice, chicken and raita",220,"Biryani",0],[1,"Veg Biryani","Fragrant vegetable biryani",160,"Biryani",1],[1,"Chicken 65","Spicy fried chicken",180,"Sides",0],
    [2,"Veg Hakka Noodles","Wok-tossed noodles",150,"Chinese",1],[2,"Chicken Fried Rice","Fried rice with chicken",190,"Chinese",0],[2,"Gobi Manchurian","Crispy cauliflower bites",140,"Sides",1],
    [3,"South Indian Meals","Rice, kootu, poriyal and more",160,"Meals",1],[3,"Curd Rice","Cooling curd rice with pickle",80,"Meals",1],
    [4,"Classic Veg Burger","Veg patty, lettuce and sauce",130,"Burgers",1],[4,"Chicken Burger","Grilled chicken burger",180,"Burgers",0],[4,"French Fries","Crispy salted fries",90,"Sides",1],
    [5,"Gulab Jamun","Two soft jamuns",70,"Sweets",1],[5,"Brownie","Chocolate brownie",100,"Desserts",1]
  ];
  for (const m of menu) addM.run(ids[m[0]],m[1],m[2],m[3],m[4],m[5]);
}

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));
app.get("/api/health",(req,res)=>res.json({ok:true,app:"Thattu"}));

function auth(req,res,next) {
  const h=req.headers.authorization||"";
  if (!h.startsWith("Bearer ")) return res.status(401).json({error:"Please log in first."});
  try { req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch { return res.status(401).json({error:"Session expired. Please log in again."}); }
}
function roles(...allowed) {
  return (req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({error:"You don't have permission for this action."});
}
function safeUser(u) { return {id:u.id,name:u.name,email:u.email,role:u.role,phone:u.phone}; }
app.post("/api/auth/register", (req,res)=>{
  const {name,email,password,phone=""}=req.body||{};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email||"") || (password||"").length<8)
    return res.status(400).json({error:"Enter a name, valid email and password with at least 8 characters."});
  try {
    const result=db.prepare("INSERT INTO users(name,email,password_hash,role,phone) VALUES(?,?,?,?,?)")
      .run(name.trim(),email.toLowerCase().trim(),bcrypt.hashSync(password,10),"customer",String(phone).slice(0,30));
    const user=db.prepare("SELECT * FROM users WHERE id=?").get(result.lastInsertRowid);
    const token=jwt.sign({id:user.id,name:user.name,email:user.email,role:user.role},JWT_SECRET,{expiresIn:"7d"});
    res.status(201).json({token,user:safeUser(user)});
  } catch { res.status(409).json({error:"This email may already be registered."}); }
});
app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.prepare("SELECT * FROM users WHERE email=?").get(String(email||"").toLowerCase().trim());
  if (!u || !bcrypt.compareSync(password||"",u.password_hash)) return res.status(401).json({error:"Email or password is incorrect."});
  const token=jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role},JWT_SECRET,{expiresIn:"7d"});
  res.json({token,user:safeUser(u)});
});
app.get("/api/me",auth,(req,res)=>{
  const u=db.prepare("SELECT id,name,email,role,phone FROM users WHERE id=?").get(req.user.id);
  u?res.json({user:u}):res.status(404).json({error:"User not found"});
});

app.get("/api/restaurants",(req,res)=>{
  const q=String(req.query.q||"").trim();
  const rows=db.prepare(`SELECT r.*, COUNT(m.id) item_count FROM restaurants r LEFT JOIN menu_items m ON m.restaurant_id=r.id AND m.available=1
    WHERE r.is_open=1 AND (r.name LIKE ? OR r.cuisine LIKE ?) GROUP BY r.id ORDER BY r.rating DESC`)
    .all(`%${q}%`,`%${q}%`);
  res.json({restaurants:rows});
});
app.get("/api/restaurants/:id/menu",(req,res)=>{
  const restaurant=db.prepare("SELECT * FROM restaurants WHERE id=?").get(Number(req.params.id));
  if(!restaurant) return res.status(404).json({error:"Restaurant not found"});
  const items=db.prepare("SELECT * FROM menu_items WHERE restaurant_id=? AND available=1 ORDER BY category,name").all(restaurant.id);
  res.json({restaurant,items});
});
app.post("/api/orders",auth,roles("customer"),(req,res)=>{
  const {items,address,phone,paymentMethod="COD"}=req.body||{};
  if(!Array.isArray(items)||items.length===0||!address?.trim()||!phone?.trim())
    return res.status(400).json({error:"Add items, delivery address and phone number."});
  if(!["COD","UPI","CARD"].includes(paymentMethod)) return res.status(400).json({error:"Unsupported payment method."});
  const ids=[...new Set(items.map(i=>Number(i.id)))];
  if(ids.some(n=>!Number.isInteger(n)||n<1)) return res.status(400).json({error:"Invalid cart items."});
  const menu=db.prepare(`SELECT m.*,r.id restaurant_id,r.delivery_fee FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id WHERE m.id IN (${ids.map(()=>"?").join(",")}) AND m.available=1`).all(...ids);
  const qtyById=new Map(items.map(i=>[Number(i.id),Math.max(1,Math.min(20,Math.floor(Number(i.quantity)||1)))]));
  if(menu.length!==ids.length) return res.status(400).json({error:"One or more items are unavailable."});
  const restaurantId=menu[0].restaurant_id;
  if(menu.some(m=>m.restaurant_id!==restaurantId)) return res.status(400).json({error:"Please order from one restaurant at a time."});
  const orderItems=menu.map(m=>({id:m.id,name:m.name,price:m.price,quantity:qtyById.get(m.id)||1,is_veg:!!m.is_veg}));
  const subtotal=orderItems.reduce((s,i)=>s+i.price*i.quantity,0);
  const deliveryFee=subtotal>=300?0:menu[0].delivery_fee;
  const tax=Math.round(subtotal*0.05);
  const total=subtotal+deliveryFee+tax;
  const info=db.prepare(`INSERT INTO orders(customer_id,restaurant_id,items_json,subtotal,delivery_fee,tax,total,payment_method,status,address,phone)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id,restaurantId,JSON.stringify(orderItems),subtotal,deliveryFee,tax,total,paymentMethod,"Placed",address.trim().slice(0,500),phone.trim().slice(0,30));
  res.status(201).json({order:{id:info.lastInsertRowid,subtotal,deliveryFee,tax,total,status:"Placed",paymentMethod,note:paymentMethod==="COD"?"Cash on delivery selected.":"Demo only: no real payment was charged."}});
});
const orderQuery=`SELECT o.*, r.name restaurant_name, u.name customer_name, d.name delivery_name
FROM orders o JOIN restaurants r ON r.id=o.restaurant_id JOIN users u ON u.id=o.customer_id
LEFT JOIN users d ON d.id=o.delivery_id`;
function shapeOrder(o){return {...o,items:JSON.parse(o.items_json),items_json:undefined};}
app.get("/api/orders/mine",auth,roles("customer"),(req,res)=>{
  res.json({orders:db.prepare(orderQuery+" WHERE o.customer_id=? ORDER BY o.id DESC").all(req.user.id).map(shapeOrder)});
});
app.get("/api/orders/active",auth,roles("restaurant","delivery","admin"),(req,res)=>{
  let sql=orderQuery+" WHERE o.status NOT IN ('Delivered','Cancelled')";
  let args=[];
  if(req.user.role==="restaurant"){
    const r=db.prepare("SELECT id FROM restaurants ORDER BY id LIMIT 1").get();
    sql+=" AND o.restaurant_id=?";args.push(r.id);
  }
  if(req.user.role==="delivery") sql+=" AND (o.delivery_id IS NULL OR o.delivery_id=?)",args.push(req.user.id);
  sql+=" ORDER BY o.id DESC";
  res.json({orders:db.prepare(sql).all(...args).map(shapeOrder)});
});
app.get("/api/admin/summary",auth,roles("admin"),(req,res)=>{
  res.json({
    users:db.prepare("SELECT role,COUNT(*) count FROM users GROUP BY role").all(),
    restaurants:db.prepare("SELECT id,name,cuisine,is_open FROM restaurants ORDER BY id").all(),
    orders:db.prepare("SELECT COUNT(*) count,COALESCE(SUM(total),0) gross FROM orders").get(),
    recent:db.prepare(orderQuery+" ORDER BY o.id DESC LIMIT 20").all().map(shapeOrder)
  });
});
app.patch("/api/orders/:id/status",auth,roles("restaurant","delivery","admin"),(req,res)=>{
  const order=db.prepare("SELECT * FROM orders WHERE id=?").get(Number(req.params.id));
  if(!order) return res.status(404).json({error:"Order not found."});
  const {status}=req.body||{};
  const allowedByRole={
    restaurant:["Preparing","Ready for pickup","Cancelled"],
    delivery:["Picked up","On the way","Delivered"],
    admin:["Placed","Preparing","Ready for pickup","Picked up","On the way","Delivered","Cancelled"]
  };
  if(!(allowedByRole[req.user.role]||[]).includes(status)) return res.status(400).json({error:"Status change not allowed for this role."});
  const deliveryId=req.user.role==="delivery"?req.user.id:order.delivery_id;
  db.prepare("UPDATE orders SET status=?,delivery_id=? WHERE id=?").run(status,deliveryId,order.id);
  res.json({ok:true,status});
});
app.patch("/api/admin/restaurants/:id/open",auth,roles("admin"),(req,res)=>{
  const open=!!req.body?.open;
  const result=db.prepare("UPDATE restaurants SET is_open=? WHERE id=?").run(open?1:0,Number(req.params.id));
  result.changes?res.json({ok:true}):res.status(404).json({error:"Restaurant not found"});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`Thattu running on http://localhost:${PORT}`));
