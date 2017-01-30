Parse.Cloud.define("getUserSessionToken", function(request, response) {

    //Parse.Cloud.useMasterKey();

    var phoneNumber = request.params.phoneNumber;
    console.log(phoneNumber);

    var query = new Parse.Query(Parse.User);
    query.equalTo("phone", phoneNumber);
    query.limit(1);

    var password = "somerandompassword";

    query.first({useMasterKey: true}).then(function(user) {
	    user.set("password", password);
	    return user.save(null, {useMasterKey: true});

	}).then(function(user){
	    return Parse.User.logIn(user.get("username"), password);
	}).then(function(user){
        console.log(user);
		
	    response.success(user.getSessionToken());
	}).fail(function() {
        response.error(arguments);
	});


});




Parse.Cloud.define("GetMerchantPhotopons", function(request, response) {

    //Parse.Cloud.useMasterKey();

    var merchantId = request.params.merchantId;

    var data = {
    	redeems: [],
    	shares: []
    };

    var query = new Parse.Query("Notifications");
    query.include("assocPhotopon");
    query.include("assocPhotopon.coupon");
    query.include("assocPhotopon.creator");

    query.each(function(notification) {
    	var type = notification.get("type");
    	var p = notification.get("assocPhotopon");

    	if (p && (type == "REDEEMED") && (data.redeems.length < 5)) {
    		var c = p.get("coupon");
    		if (c.get("owner").id == merchantId) {
    			data.redeems.push(p);
    		}
    	}

    	if (p && (type == "PHOTOPON") && (data.shares.length < 5)) {
    		var c = p.get("coupon");
    		if (c.get("owner").id == merchantId) {
    			data.shares.push(p);
    		}
    	}

    	if ((data.redeems.length >= 5) && (data.shares.length >= 5)) {
    		response.success(data);
    	}

    }, {
    	useMasterKey: true,
    	success: function() {
            response.success(data);
        },
        error: function(error) {
            response.error(error.description);
        }
    });

});



Parse.Cloud.define("UserStats", function(request, response) {

    //Parse.Cloud.useMasterKey();

    var query = new Parse.Query(Parse.User);

    var stats = {
		merchants: 0,
		activeMerchants: 0,
		consumers: 0,
		activeConsumers: 0,
		all: 0,
		todaysSignup: 0
	};

    query.each(function(user) {
    	
		stats.all++;

		var isMerchant = user.get("isMerchant");
		var lastLogin = user.get("lastLogin");
		var createdAt = user.get("createdAt");

		var isRecent = false;

		if (lastLogin) {
			isRecent = ((new Date()).getTime() - lastLogin.getTime()) <= 24 * 60 * 60 * 1000;
		}

		var createdToday = ((new Date()).getTime() - createdAt.getTime()) <= 24 * 60 * 60 * 1000;

		var d = ( (new Date()).getTime() - createdAt.getTime() ) / (24 * 60 * 60 * 1000);

		console.log(user.get("username") + " " + d);
		//console.log((new Date()).getTime());
		//console.log(createdAt.getTime());

		if (createdToday) {
			stats.todaysSignup++;
		}

		if (isMerchant) {
			stats.merchants++;

			if (isRecent) {
				stats.activeMerchants++;
			}
		} else {
			stats.consumers++;

			if (isRecent) {
				stats.activeConsumers++;
			}
		}

    }, {
    	useMasterKey: true,
    	success: function() {
            response.success(stats);
        },
        error: function(error) {
            response.error(error.description);
        }
    });

});



Parse.Cloud.job("RemoveDuplicateZips", function(request, status) {
  //Parse.Cloud.useMasterKey();
  var _ = require("underscore");

  var hashTable = {};

  var testItemsQuery = new Parse.Query("EnabledLocations");

  testItemsQuery.each(function (testItem) {
    var key = testItem.get("zipcode");

    if (key in hashTable) { // this item was seen before, so destroy this
        return testItem.destroy();
    } else { // it is not in the hashTable, so keep it
        hashTable[key] = 1;
    }

  }, {
  	useMasterKey: true
  }).then(function() {
    console.log("Migration completed successfully.");
  }, function(error) {
    console.log("Uh oh, something went wrong.");
  });
});


Parse.Cloud.define("MyCoupons", function(request, response) {
	//Parse.Cloud.useMasterKey();
	

	var hashTable = {};

	var d = new Date();
	var todaysDate = new Date(d.getTime()); 

	var myCoupons = new Parse.Query("Coupon");
	myCoupons.include("company");
	myCoupons.equalTo("isActive", true);
	myCoupons.greaterThanOrEqualTo("expiration", todaysDate);


	var myRedeems = new Parse.Query("RedeemedCoupons");
	myRedeems.equalTo("user", request.user);





	myCoupons.find({
		useMasterKey: true,
		success: function (allCoupons) {
		
			var redeemed = [];
			
			myRedeems.find({
				useMasterKey: true,
				success: function(redeems) {

					for (var i = 0; i < allCoupons.length; i++) {
						redeemed.push(false);
						var c = allCoupons[i];

						for (var j = 0; j < redeems.length; j++) {
							var r = redeems[j];

							if (r.get("coupon").id == c.id) {
								redeemed[i] = true;
								break;
							}
						}
					}

					response.success({
						coupons: allCoupons,
						redeems: redeemed,
						params: request.params 
					});

				},
				error: function(err) {

				}
			});

					
		},
		error: function() {

		}
	});


});



Parse.Cloud.define("ServerTime", function(request, response) {
	var time = new Date();
	response.success(time.getTime());
});

Parse.Cloud.afterSave("MerchantRequests", function(request) {

	if (request.object.get("isAccepted")) {
		//Parse.Cloud.useMasterKey();
		request.object.get("user", {useMasterKey: true}).set("isMerchant", true);
		request.object.get("user", {useMasterKey: true}).save({useMasterKey: true});
		request.object.destroy({useMasterKey: true});
	}

});



Parse.Cloud.beforeSave("Verifications", function(request, response) {
	var numTried = request.object.get("numTried") || 0;
	request.object.set("numTried", numTried + 1);


	var client = require('twilio')('AC411575f00f763f4fbaf602173db1c518', '8537400eebcb197b068110ffb552df44');

	
	// Send an SMS message
	client.sendSms({
	    to:'+1' + request.object.get("phoneNumber"),
	    from: '+12015100525',
	    url:'https://demo.twilio.com/welcome/sms/reply/',
	    body: 'Your verification code: ' + request.object.get("code")
	  }, function(err, responseData) {
	    if (err) {
			console.log(err);
			response.success();
	    } else {
			console.log(responseData.from);
			console.log(responseData.body);

    		response.success();
	    }
	  }
	);

    //response.success();
});

Parse.Cloud.beforeSave("Friends", function(request, response) {
	var user1 = request.object.get("user1");
	var user2 = request.object.get("user2");
	var phoneId = request.object.get("phoneId");

	var fship = new Parse.Query("Friends");
	fship.equalTo("user1", user1);

	if (user2) {
		fship.equalTo("user2", user2);
	} else {
		fship.equalTo("phoneId", phoneId);
	}
	
	fship.find({
		success: function(objects) {
			if (objects.length > 0) {
				response.error("Friendship already exists");
			} else {
				response.success();
			}
		},
		error: function(error) {
			response.error(error);
		}
	});

});


Parse.Cloud.beforeSave("Photopon", function(request, response) {

	request.object.set("creator", request.user);
	request.object.set("installationId", request.installationId);

    var groupACL = new Parse.ACL();
    groupACL.setPublicReadAccess(true);
    groupACL.setWriteAccess(request.user, true);
    request.object.setACL(groupACL);
 	
	request.user.set("lastPhotopon", new Date());


	var PerUserShareClass = Parse.Object.extend("PerUserShare");

	var friends = request.object.get("users");

	for (var i = 0; i < friends.length; i++) {
		var friend = new Parse.User();
		friend.id = friends[i];
			
		var sh = new PerUserShareClass();

		sh.set("user", request.user);
		sh.set("coupon", request.object.get("coupon"));
		sh.set("friend", friend);

		sh.save();
	}


	request.user.save(null, {
		success: function(user) {
			response.success();
		},
		error: function(user, error) {
			response.error();
		}
	});
	
});


Parse.Cloud.afterSave("Notifications", function(request) {

	var user = request.object.get("to");
	var assocUser = request.object.get("assocUser");
	
	var notificationType = request.object.get("type");
	var channelName = "User_" + user.id;


	assocUser.fetch({
		success: function(assocUser) {
			console.log(assocUser);
			var photoponId;

			var message = "";
			if (notificationType == "PHOTOPON") {

				message = "User " + assocUser.get("username") + " sent you Photopon!"
				photoponId = request.object.get("assocPhotopon").id;

			} else if (notificationType == "MESSAGE") {
				message = assocUser.get("username") + ": " + request.object.get("content");

			} else if (notificationType == "FRIEND") {
				message = assocUser.get("username") + " added you";

			} else if (notificationType == "ADDWALLET") {
				message = assocUser.get("username") + " saved your Photopon";

			} else if (notificationType == "REDEEMED") {
				message = assocUser.get("username") + " redeemed your Photopon";

			}


			Parse.Push.send({
				channels: [ channelName ],
				data: {
					type: notificationType,
					notificationId: request.object.id,
					badge: "Increment",
					alert: message
				}
			}, {
				success: function() {

				},
				error: function(error) {
				// Handle error
				}
			});


		},
		error: function(error) {
		// Handle error
		}
	});

});


Parse.Cloud.job("CreateBills", function(request, response) {
		var WhenBillsGenerated = function(merchantCouponMap) {
			var numMerchants = Object.keys(merchantCouponMap).length;
			response.success("Generated " + numMerchants + " invoices");
		};


		var GetLastBill = function(id, callback) {

			var user = new Parse.User();
			user.id = id;


			var billQuery = new Parse.Query("Bills");
			billQuery.equalTo("user", user);
			billQuery.descending("generation");
			
			billQuery.first({
				success: function(object) {
					callback(object);
				},
				error: function(error) {
					callback(null);
				}
			});


		};


		var GenerateBillForMerchant = function(merchantId, coupons, properties, callback) {
			var BillClass = Parse.Object.extend("Bills");

			var centPerShare = properties.centPerShare ? properties.centPerShare : 5;
			var centPerRedeem = properties.centPerRedeem ? properties.centPerRedeem : 25;

			GetLastBill(merchantId, function(lastBill) {

				var totalShares = 0;
				var totalRedeems = 0;

				var minCouponTime = new Date();
				for (var i = 0; i < coupons.length; i++) {

					if (coupons[i].createdAt < minCouponTime) {
						minCouponTime = coupons[i].createdAt;
					}

					totalShares += parseInt(coupons[i].get("numShared") || 0, 10);
					totalRedeems += parseInt(coupons[i].get("numRedeemed") || 0, 10);
				};


				var lastTotalShared = parseInt(lastBill ? (lastBill.get("numShared") || 0) : 0, 10);
				var lastTotalRedeemed = parseInt(lastBill ? (lastBill.get("numRedeemed") || 0) : 0, 10);

				var generation = parseInt(lastBill ? lastBill.get("generation") : 0, 10);

				var currentShared = totalShares - lastTotalShared;
				var currentRedeemed = totalRedeems - lastTotalRedeemed;


				var user = new Parse.User();
				user.id = merchantId;
				
				var bill = new BillClass();

				bill.set("numShared", totalShares);
				bill.set("numRedeemed", totalRedeems);

				bill.set("currentShares", currentShared);
				bill.set("currentRedeems", currentRedeemed);

				bill.set("centPerShare", centPerShare);
				bill.set("centPerRedeem", centPerRedeem);

				bill.set("previousBillDate", lastBill ? lastBill.createdAt : minCouponTime);

				bill.set("generation", generation + 1);


				bill.set("user", user);



				bill.save(null, {
					success: function(bill) {
						callback();
					},
					error: function(bill, error) {
						throw ("Failed to save object.");
					}
				});
			});


		};

		var WhenCouponsFetched = function(merchantCouponMap, companyProperties) {

			var numMerchantsLeft = Object.keys(merchantCouponMap).length;


			for (var merchantId in merchantCouponMap) {
				GenerateBillForMerchant(merchantId, merchantCouponMap[merchantId], companyProperties[merchantId], function() {
					numMerchantsLeft--;
					if (numMerchantsLeft == 0) {
						WhenBillsGenerated(merchantCouponMap);
					}
				});
			}

		};


		var GetMerchantCoupons = function() {
			var Company = Parse.Object.extend("Company");

			var queryCompany = new Parse.Query(Company);
			queryCompany.include("merchant");

			queryCompany.find({

				success: function(companies) {
					var merchants = {};
					var companyProperties = {};

					for (var i = 0; i < companies.length; i++) {
						
						var company = companies[i];
						var merchantObject = company.get("merchant");

						var numRequests = companies.length;
					
						if (!merchantObject) {
							console.log("Error: Merchant not found for company " + company.get("name") + " [" + company.id + "]");
							
							numRequests = numRequests - 1;

							if (numRequests == 0) {
								WhenCouponsFetched(merchants, companyProperties);
							}
							continue;
						}

						merchants[merchantObject.id] = [];
						companyProperties[merchantObject.id] = {
							centPerShare: company.get("centPerShare"),
							centPerRedeem: company.get("centPerRedeem")
						};


						(function(id) {
							
							console.log("Getting " + id);
							
							var user = new Parse.User();
							user.id = id;


							var couponQuery = new Parse.Query("Coupon");
							couponQuery.equalTo("owner", user);
							couponQuery.find({
								success: function(merchantCoupons) {
									numRequests = numRequests - 1;

									for (var j = 0; j < merchantCoupons.length; j++) {
										merchants[id].push(merchantCoupons[j]);
									};

									if (numRequests == 0) {
										WhenCouponsFetched(merchants, companyProperties);
									}

								},
								error: function(error, res) {
									throw error;
								}
							})

						})(merchantObject.id);




					}
				
				},
				error: function(error) {
					throw ("Error: " + error.code + " " + error.message);
				}
			});
		};



		try {
			GetMerchantCoupons();
		} catch (ex) {
			response.error(ex);
		}

		


});
