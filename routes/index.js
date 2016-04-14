var express = require('express');
var router = express.Router();
var knex = require('knex')(require('../knexfile')[process.env.DB_ENV]);
var fs = require('fs');
var Handlebars = require("handlebars");
var stripe = require("stripe")(process.env.TEST_SECRET_KEY);
var stripeToken;

var dotenv = require('dotenv');
var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME,process.env.SENDGRID_PASSWORD);

//get file
var regEmail = fs.readFileSync('./views/email.hbs', 'utf-8');
//compile template
var compiledTemplate = Handlebars.compile(regEmail);
var msg='';
var amount=0;

function isloggedIn(req, res, next) {
    if (!req.session.passport) return res.redirect('/users/login')
    next();
}

router.get('/', function(req, res, next) {
    knex('items')
        .select('name', 'description', 'price', 'image_url', 'id')
        .then(function(items) {
            if (!req.session.passport) return res.render('index',{items});

            res.render('index', {
                items: items,
                admin: req.session.passport.user.admin,
                name: req.session.passport.user.name,
                photo: req.session.passport.user.photo
            });
        })
});

router.post('/cart/add/:item_id', isloggedIn, function(req, res, next) {
    knex('users_cart')
        .insert({
            user_id: req.session.passport.user.user_id,
            item_id: req.params.item_id
        })
        .returning('*')
        .then(function(data) {
            res.redirect('/');
        })
})

router.get('/cart', isloggedIn,function(req, res,next){
  knex('users_cart')
  .where({user_id: req.session.passport.user.user_id})
  .innerJoin('items', 'users_cart.item_id', 'items.id')
  .then(function(data){

      return knex('users')
      .where({id: req.session.passport.user.user_id})
      .then(function(user){
          var toPay= 0;

          for (var i = 0; i < data.length; i++) {
            toPay += Number(data[i].price);
          }
          toPay= toPay.toFixed(2);
          var arr = toPay.split('');
          arr.splice(2,1);
          amount = Number(arr.join(''));
          amount += amount * 0.8;

        res.render('cart',{
          name: req.session.passport.user.name,
          photo: req.session.passport.user.photo,
          data: data,
          user: user,
          msg: msg,
          key: process.env.TEST_SECRET_KEY,
          amount: amount
        });
      })
      msg='';
  })
})

router.get('/cart/:id/delete', isloggedIn,function(req, res, next){
  knex('users_cart')
  .where({
    user_id: req.session.passport.user.user_id,
    item_id: req.params.id
  })
  .first()
  .del()
  .then(function(data){
    res.redirect('/cart');
  })
})

router.get('/products', function(req, res, nex){
  knex('items')
  .select('name', 'description', 'price', 'image_url', 'id')
  .then(function(items) {
      if (!req.session.passport){
           res.render('products',{items: items});
       } else {
           res.render('products', {
               items: items,
               name: req.session.passport.user.name,
               photo: req.session.passport.user.photo
           });
       }
  })
})

router.get('/product/:id', function(req, res, nex){
  knex('items')
  .where({id:req.params.id})
  .select('name', 'description', 'price', 'image_url', 'id')
  .then(function(item) {
    res.render('product',{item:item[0]});
  });
})

router.post('/cart/payment', function(req,res, next){
  stripeToken = req.body.stripeToken;

  var charge = stripe.charges.create({
  amount: amount, // amount in cents, again
  currency: "usd",
  source: stripeToken,
  description: "Example charge"
  }, function(err, charge) {
    if (err && err.type === 'StripeCardError') {
      console.log('STRIP ERROR',err);
      res.redirect('/cart')
    }
    msg= 'Successful payment!'
  res.redirect('/cart');
});

})
module.exports = router;
