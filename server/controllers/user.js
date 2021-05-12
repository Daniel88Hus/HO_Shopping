const User = require("../models/user")
const Product = require("../models/product")
const Cart = require("../models/cart")
const Coupon = require("../models/coupon")
const Order = require("../models/order")



exports.userCart = async(req, res) => {
  const {cart} = req.body
  // console.log(cart)
  let products = []
  const user = await User.findOne({email: req.user.email}).exec()
  let cartExistByThisUser = await Cart.findOne({orderdBy: user._id}).exec()
  
  // if (cartExistByThisUser) {
  //   cartExistByThisUser.remove()
  // }
  for ( let i = 0; i<cart.length; i++){
    let object = {}
    object.product = cart[i]._id
    object.count = cart[i].count
    object.color = cart[i].color
    //getting price from our DB not front, to prevent price change from local storage manually
    let productFromDb = await Product.findById(cart[i]._id).select("price").exec()
    object.price = productFromDb.price
    products.push(object)
// console.log("enoguh2  ")
  }
  // console.log("products that saved DB", products)

  let cartTotal = 0
  for (let i=0; i<products.length; i++){
    cartTotal = cartTotal + products[i].price * products[i].count
    // console.log("enough")
  }
  console.log("cartTotal", cartTotal)
  let newCart = await new Cart({
    products,
    cartTotal,
    orderdBy: user._id,
  }).save()
  // console.log("new Cart----->", newCart)
  res.json({ ok: true})
}

exports.getUserCart = async (req,res) => {
  const user = await User.findOne({email: req.user.email}).exec()

  let cart = await Cart.findOne({ orderdBy : user._id})
  .populate("products.product", "_id title price totalAfterDiscount").exec()
  // without 2nd argument it populates everyhitng but 2nd argument is restriction to populate fields

  const {products, cartTotal, totalAfterDiscount} = cart
  res.json({products, cartTotal, totalAfterDiscount})
}

exports.saveAddress = async (req,res) => {
  const userAdress = await User.findOneAndUpdate({ email: req.user.email},
    {address: req.body.address}).exec()
    res.json({ok: true})
}

exports.applyCouponToUserCart = async (req,res) => {
  const { coupon } = req.body
  console.log("user input coupon comes to server", coupon)

  let validCoupon = await Coupon.findOne({name: coupon}).exec()
  if (validCoupon === null) {
    return res.json({
      err: "Invalid Coupon"
    })
  }
  // console.log("validCoupon:", validCoupon)
 
  const user = await User.findOne({email: req.user.email}).exec()

  let {products, cartTotal} = await Cart.findOne({orderdBy: user._id})
  .populate("products.product", "_id title price").exec()

  console.log("cartTotal, ", cartTotal , "products:", products, "user:", user, "validCoupon.discount:", validCoupon.discount)
 
  let totalAfterDiscount = (cartTotal - (cartTotal * validCoupon.discount)/100).toFixed(2)
console.log("----------->", totalAfterDiscount) 
  Cart.findOneAndUpdate({orderdBy: user._id}, {tolalAfterDiscount: totalAfterDiscount}, {new: true}).exec()
  res.json(totalAfterDiscount)
}

exports.createOrder = async (req, res) => {
  // console.log("create order req.user", req.user)
  
  const {paymentIntent} = req.body.stripeResponse
  const user = await User.findOne({email: req.user.email}).exec()
  let {products} = await Cart.findOne({ orderdBy : user._id}).exec()
  let newOrder = await new Order({
    products, paymentIntent, orderdBy: user._id
  }).save()

  //decrement quantity, increment sold
  let bulkOption = products.map((item) => {
    return {updateOne: {
      filter: {_id: item.product._id}, //products is array in model
      update: {$inc: {quantity: -item.count, sold: +item.count}}
    }}
  })
  let updated = await Product.bulkWrite(bulkOption, {new: true}) //mongoose query

  // console.log("NEW ORDER SAVED", newOrder)
  res.json({ok: true})
}

exports.emptyUserCart = async (req, res) => {
  
  // console.log("empty cart req.user", req.user)
  const user = await User.findOne({ email: req.user.email }).exec();
  const cart = await Cart.findOneAndRemove({ orderdBy: user._id }).exec();
  res.json(cart); 
}

exports.orders = async (req, res) => {
  const user = await User.findOne({ email: req.user.email }).exec();
  let userOrders = await Order.find({orderdBy: user._id})
  .populate("products.product")
  .exec()
  res.json(userOrders)

}

// addToWishlist wishlist removeFromWishlist
exports.addToWishlist = async (req, res) => {
  const { productId } = req.body;
  // console.log(productId)

  const user = await User.findOneAndUpdate(
    { email: req.user.email },
    { $addToSet: { wishlisht: productId } } // to not update same product again and again when user click many times 
  ).exec();

  res.json({ ok: true });
};

exports.wishlist = async (req, res) => {
  const list = await User.findOne({ email: req.user.email })
    .select("wishlisht")
    .populate("wishlisht")
    .exec();

  res.json(list);
};

exports.removeFromWishlist = async (req, res) => {
  const { productId } = req.params;
  const user = await User.findOneAndUpdate(
    { email: req.user.email },
    { $pull: { wishlisht: productId } }
  ).exec();

  res.json({ ok: true });
};