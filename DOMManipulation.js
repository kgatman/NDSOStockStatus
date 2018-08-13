dhis2.util.on( 'dhis2.de.event.formLoaded', function( event, ds){
    hideProducts();
});    

dhis2.util.on( 'dhis2.de.event.completed', function( event, ds){

    if ( $.inArray( ds, ['JxJpNfFEKw7'] ) == -1 ) {
        return false;
    }
	
	var tabIdCollection = ["tbMedication", "medicalSupplies", "familyPlanning", "nutrition", "laboratory", "emLiquid", "arv", "hiv"];
		
	// Disable appropriate fields
	toggleTabEnableDisable(tabIdCollection, false);
	
	// Disable incomplete button
	$('#undoButton').hide();
});

dhis2.util.on( 'dhis2.de.event.dataValuesLoaded', function( event, ds ) {

    if ( $.inArray( ds, ['JxJpNfFEKw7'] ) == -1 ) {
        return false;
    }
	showHideRelevantCols();
});

// a. Make an api call to ME to get User Roles
function getUserRole() {
  
	 var result = $.get( "../api/me.json?fields=userCredentials[userRoles[name]]", function(data){
          //result = data;
     });
	
	return result;
}

// Get user name and surname
function getUserDetails(usrname){
	// "http://localhost:8080/dhis/dhis-web-commons-ajax-json/getUser.action?username=Teboho"

	var result = $.get( "../dhis-web-commons-ajax-json/getUser.action?username=" + usrname, function(usrDetails){});
	
	return result;
}

// Hide the district level user columns
function showHideRelevantCols(){

	var tabIdCollection = ["tbMedication", "medicalSupplies", "familyPlanning", "nutrition", "laboratory", "emLiquid", "arv", "hiv"];
	
	// Enable all fields
	toggleTabEnableDisable(tabIdCollection, true);

	// Show incomplete button
	$('#undoButton').show();

	
	var resultPromise = getUserRole();
	var completenessPromise = getDataSetCompletenessStatus();
	
	resultPromise.done(function(role){
		completenessPromise.done(function(complObj){
		
			console.log(complObj);
			// create variable to carry completeness status
			var isDataSetCompleted = false;
			
		if(complObj.completeDataSetRegistrations){
			if(complObj.completeDataSetRegistrations.length > 0){
				isDataSetCompleted = true;
			}
		}								
			// If data set has been approved at facility level, and awaiting approval at district level
			var isApprovedPromise = IsApprovedByDLO(),
			   approvalBool,
			   approvalStatus;
		   

			isApprovedPromise.done(function(data){
				 if(data.mayApprove == false){
				   approvalBool = false;
				 }else if(data.mayApprove == true){
				   approvalBool = true;
				}

				console.log(approvalBool);
				console.log(role);

				var isFLO = false;
				var isDLO = false;

				role.userCredentials.userRoles.forEach(function(item){
					 if(item.name == "FLO"){
						isFLO = true;
					 }else if(item.name == "DLO"){
						isDLO = true;
					 }
				});
				
				if( isFLO && approvalBool == false){
					// Hide relevant columns
				   for(var i = 7; i <= 13; i++) {
					   $('td:nth-child('+i+')').hide();
				   }
				   // Show the last column for paediatricRegimens
				   $('#paediatricRegimens td:nth-child(7)').show();
				   
				   if(isDataSetCompleted){
						// Disable all inputs on the form is current use is FLO user and hide the incomplete button otherwise enable inputs and show incomplete button
						toggleTabEnableDisable(tabIdCollection, false);
						
						// Disable incomplete button
						$('#undoButton').hide();
					}
				}else if(isDLO && approvalBool == true && data.state == "UNAPPROVED_READY" && isDataSetCompleted){
					 // SHOW ALL COLUMNS, DO AMC CALCULATIONS AND SHOW FRQ CALCULATIONS BUTTON
					 $('#btnCalculateFRQ').show();
					 // Arrays to store data values for last periods
					 var lastMonthArray = [];
					 var last2MonthsArray = [];
					 
					 var prevPeriods = determineLastThreePeriods();

					 $.when(getLastMonthAMCVars(prevPeriods), getLast2MonthsAMCVars(prevPeriods)).done(function(lastMonthAMC, last2MonthsAMC){
						console.log(lastMonthAMC);
						console.log(last2MonthsAMC);
						
						// Load the two associative arrays
						lastMonthAMC.dataValues.forEach(function(item){
							lastMonthArray.push({ id: item.id, val: item.val });
						});
						
						last2MonthsAMC.dataValues.forEach(function(item){
							last2MonthsArray.push({ id: item.id, val: item.val });
						});
						
						// MEDICAL SUPPLIES
						tabIdCollection.forEach(function(tableName){						
							var table = $('#' + tableName + ' tbody');
							
							table.find('tr').each(function(i, el){
								var $tds = $(this).find('td');
								var $inps = $tds.find('input');
						  
								var uids = determineUniqueIDs($inps, i);
								
								// Using the determined UIDS for SHL iterate through the data values array for last month and derive value for SHL
								LoadSHLDataValuesToForm(uids, lastMonthArray, i);

								// g. calculateSaveAdjustedMonthlyConsumption
								calculateSaveAdjustedMonthlyConsumption(uids, lastMonthArray, last2MonthsArray, i);
							});
						});
					});
				}else if(isDLO && !isDataSetCompleted){
					//Hide completeness button
					$('#completeButton').hide();
					// Ensure the button for FRQ calculation is hidden
					$('#btnCalculateFRQ').hide();					
				}else if(isDLO && approvalBool == false && data.state == "APPROVED_HERE"){
					// Ensure the button for FRQ calculation is hidden
					$('#btnCalculateFRQ').hide();
				}else if(isFLO && approvalBool == false && data.state == "APPROVED_HERE"){
					// SHOW THE FINAL REQUISITION QUANTITY
					tabIdCollection.forEach(function(tableName){
						$('#' + tableName + ' td:nth-child(13)').show();
					});					
				
					// Ensure the button for FRQ calculation is hidden
					$('#btnCalculateFRQ').hide();
				}else{
					// DO NOT DO ANYTHING JUST SHOW LOCKED FORM
				}
			});
		});
   });
}

function toggleTabEnableDisable(tabIdArray, active){

	tabIdArray.forEach(function(tableName){
		var table = $('#' + tableName + ' tbody');
		 
		table.find('tr').each(function(i, el){
			var $tds = $(this).find('td');
			var $inps = $tds.find('input');
			
			$inps.each(function(idx){
				// Skip the indicator fields
				if(idx != 9 || idx != 10){
					if(active){
						// Enable
						$(this).prop("readonly", false);
					}else if(!active){
						// Disable
						$(this).prop("readonly", true);
					}
				}
			});
		});
	});
}

// Calculate the final requisition quantity from the recommended requisition quantity
function calculateFRQ(){

	var tabIdCollection = ["tbMedication", "medicalSupplies", "familyPlanning", "nutrition", "laboratory", "emLiquid", "arv", "hiv"];
	
	tabIdCollection.forEach(function(tableName){
		var table = $('#' + tableName + ' tbody');
		 
		table.find('tr').each(function(i, el){
			var $tds = $(this).find('td');
			var $inps = $tds.find('input');
			
			var uidsFRQ = {};
			
			$inps.each(function(idx){
				if(i > 0){
					if(idx == 8){//AMC
						uidsFRQ.AMC = $(this).attr('id');
					}else if(idx == 10){//RRQ
						uidsFRQ.RRQ = $(this).attr('id');			
					}else if(idx == 11){//FRQ
						uidsFRQ.FRQ = $(this).attr('id');
					}else {
						// nothing
					}
				}
			});		
			
			var currentAMC = $('#' + uidsFRQ.AMC).val(),
				currentRRQ = $('#' + uidsFRQ.RRQ).val();
							
			// 3. Assign and save it to the Final Requisition Quantity
			//	if the RRQ is negative assign 0 to the FRQ; skip if AMC is not present
			if(currentAMC){
				if(parseInt(currentRRQ) < parseInt(0)){
					currentRRQ = 0;
				}
				// Assign the current RRQ to current FRQ and save
				$('#' + uidsFRQ.FRQ).val(currentRRQ);
				$('#' + uidsFRQ.FRQ).trigger('change');
			}
		});
	});
}

//Check if data set has been approved by DLO	 
function IsApprovedByDLO(){
    var sel = dhis2.de.api.getSelections();
	
	var orgUnit = sel["ou"];
	var period = sel["pe"];

	var approvalPromise = $.get( "../api/dataApprovals?ds=JxJpNfFEKw7&pe=" + period + "&ou=" + orgUnit, function(data){
               
		  });
    return approvalPromise;
}

// UTILITY FUNCTIONS FOR AMC AND SHL CALCULATIONS

function calculateSaveAdjustedMonthlyConsumption(uids, lastMonthArray, last2MonthsArray, rowIdx){
	if(rowIdx > 0){
		var lastMonthMC = calculateMonthlyConsumptions(uids, lastMonthArray);
		var last2MonthsMC = calculateMonthlyConsumptions(uids, last2MonthsArray);
		
		// Get variables to calculate MC for the current month and current row and calculate MC
		var shlUIDSelector = '#' + uids.SHL;
		var qrUIDSelector = '#' + uids.QR;
		var shUIDSelector = '#' + uids.SH;		
		var toUIDSelector = '#' + uids.TO;
		var amcUIDSelector = '#' + uids.AMC;		

		var SHL = $(shlUIDSelector).val();
		var QR = $(qrUIDSelector).val();
		var SH = $(shUIDSelector).val();
		var TO = $(toUIDSelector).val();

		if(!TO){
			TO = "0";
		}

		var thisMonthMC = parseInt(SHL) + parseInt(QR) - parseInt(SH) - parseInt(TO);
		var indicatorIDCheck = uids.AMC;
		
		if(SHL && QR && (indicatorIDCheck.substring(0, 8) != "indicator")){
				
			//	
				
			//	
			
			
			if((lastMonthMC && lastMonthMC > 0) && (last2MonthsMC && last2MonthsMC > 0) && (thisMonthMC && thisMonthMC > 0)){
				var amc = (lastMonthMC + last2MonthsMC + thisMonthMC)/3;

				if(amc < 0){
					amc = 0;
				}
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if((lastMonthMC && lastMonthMC > 0) && (thisMonthMC && thisMonthMC > 0) && (!last2MonthsMC)){
				var amc = (lastMonthMC + thisMonthMC)/2;
				
				if(amc < 0){
					amc = 0;
				}
				
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');		
			}else if((!lastMonthMC) && (thisMonthMC && thisMonthMC > 0) && (last2MonthsMC && last2MonthsMC > 0)){
				var amc = (last2MonthsMC + thisMonthMC)/2;

				if(amc < 0){
					amc = 0;
				}
				
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if((!lastMonthMC) && (thisMonthMC && thisMonthMC > 0) && (!last2MonthsMC)){
				var amc = (thisMonthMC);

				if(amc < 0){
					amc = 0;
				}				
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if(SHL == 0 && QR == 0 && SH == 0 && (TO == 0 || !TO) && lastMonthMC == 0 && last2MonthsMC == 0){
				var amc = 0;
								
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if(lastMonthMC <= 0 && (thisMonthMC && thisMonthMC > 0) && (last2MonthsMC && last2MonthsMC > 0)){
				var amc = (last2MonthsMC + thisMonthMC)/2;
				
				if(amc < 0){
					amc = 0;
				}
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if(lastMonthMC <= 0 && (thisMonthMC && thisMonthMC > 0) && (!last2MonthsMC)){
				var amc = (thisMonthMC);
				
				if(amc < 0){
					amc = 0;
				}
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if((lastMonthMC && lastMonthMC > 0) && (thisMonthMC && thisMonthMC > 0) && last2MonthsMC <= 0){
				var amc = (lastMonthMC + thisMonthMC)/2;
				
				if(amc < 0){
					amc = 0;
				}				
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');		
			}else if(lastMonthMC <= 0 && (thisMonthMC && thisMonthMC > 0) && last2MonthsMC <= 0){
				var amc = (thisMonthMC);
				
				if(amc < 0){
					amc = 0;
				}				
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if(thisMonthMC <= 0 && (lastMonthMC && lastMonthMC > 0) && last2MonthsMC <= 0){
				var amc = (lastMonthMC);
				
				if(amc < 0){
					amc = 0;
				}				
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if((!lastMonthMC) && (!last2MonthsMC) && thisMonthMC <= 0){
				var amc = 0;
								
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');
			}else if((!last2MonthsMC) && (lastMonthMC && lastMonthMC > 0) && (thisMonthMC <= 0)){
				var amc = (lastMonthMC);
				
				if(amc < 0){
					amc = 0;
				}
				// LOAD AMC TO THE SCREEN
				$(amcUIDSelector).val(parseFloat(amc).toFixed(2));
				$(amcUIDSelector).trigger('change');				
			}
		}
	}
}

function calculateMonthlyConsumptions(uids, lastPeriodArray){
	// SHL + QR - SH - TO
	var mcVariables = {};
	// GET VALUES FOR THE VARIABLES ABOVE FOR THE CURRENT ROW

	// Use the unique identifier for SHL
	var splitSHL = splitFieldUID( uids.SHL );
	
	// Use the unique identifier for QR
	var splitSQR = splitFieldUID( uids.QR );

	// Use the unique identifier for SH
	var splitSH = splitFieldUID( uids.SH );
	
	// Use the unique identifier for TO
	var splitTO = splitFieldUID( uids.TO );
	
	var currentRowSHLUID = splitSHL.dataElementId + "-" + splitSHL.optionComboId;
	var currentRowQRUID = splitSQR.dataElementId + "-" + splitSQR.optionComboId;
	var currentRowSHUID = splitSH.dataElementId + "-" + splitSH.optionComboId;
	var currentRowTOUID = splitTO.dataElementId + "-" + splitTO.optionComboId;

	// Iterate through the last period data value array and for the current table row derive the SHL,QR, SH and TO data values
	// Calculate the MC and return the result for MC
	
	lastPeriodArray.forEach(function(item){		
		if(item.id == currentRowSHLUID){
			// value of the current SHL
			mcVariables.SHL = item.val;
		}else if(item.id == currentRowQRUID){
			// value of the current QR
			mcVariables.QR = item.val;
		}else if(item.id == currentRowSHUID){
			// value of the current SH
			mcVariables.SH = item.val;
		}else if(item.id == currentRowTOUID){
			// value of the current TO
			mcVariables.TO = item.val;
		}else{
			// do nothing
		}
	});
	
	var monthlyConsumption = 0;
	// Divide by the number of months where AMC is greater than 0 for previous

	if(mcVariables.SHL){
	
		if(!mcVariables.TO){
			mcVariables.TO = "0";
		}
		
		monthlyConsumption = parseInt(mcVariables.SHL) + parseInt(mcVariables.QR) - parseInt(mcVariables.SH) - parseInt(mcVariables.TO);
	}
	return monthlyConsumption;
}

function LoadSHLDataValuesToForm(uids, lastMonthArray, rowIdx){
	if(rowIdx > 0){
		// Use the unique identifier for SHL
		var splitSHL = splitFieldUID( uids.SHL );
		
		// Use the unique identifier for SH
		var splitSH = splitFieldUID( uids.SH );

		
		var currentRowSHLUID = splitSHL.dataElementId + "-" + splitSHL.optionComboId;
		var currentRowSHUID = splitSH.dataElementId + "-" + splitSH.optionComboId;

		// Iterate through the last month array and for the current table row derive the shl data value
		lastMonthArray.forEach(function(item){
					
			if(item.id == currentRowSHUID){
				// value of the current SHL
				var currentPeriodSHLVal = item.val;
				
				// Once the shl is found assign it to the form using the correct identifier and save/persist it to the database
				var shlUIDSelector = '#' + currentRowSHLUID + '-val';
				
				$(shlUIDSelector).val(parseInt(currentPeriodSHLVal));
				$(shlUIDSelector).trigger('change');
			}
		});
	}
}

function splitFieldUID( id )
{
    var splitObj = {};
	
	if(id){
		splitObj.dataElementId = id.split( '-' )[0];
		splitObj.optionComboId = id.split( '-' )[1];
		splitObj.valSuffix = id.split( '-' )[2];
	}
	
    return splitObj;
}

// Function takes in the uniqueIds and lastPeriods
function getLast2MonthsAMCVars(lastPeriods){

	var deferredObject = $.Deferred();
	var dataValues = {};
		
	var params = {
		periodId : lastPeriods.last2Months,
        dataSetId : 'JxJpNfFEKw7',
        organisationUnitId : dhis2.de.getCurrentOrganisationUnit(),
        multiOrganisationUnit: dhis2.de.multiOrganisationUnit
    };
	
	$.ajax( {
    	url: 'getDataValues.action',
    	data: params,
	    dataType: 'json',
	    error: function() // offline
	    {

	    },
	    success: function( json ) // online
	    {
			deferredObject.resolve(json);
        },
        complete: function()
        {

        }
	} );
	return deferredObject.promise(); 
}

// Function return the start and end dates of selected month`
function getStartAndEndDates(period){
	// Split day and month
	var selectedYear = period.substring(0, 4);
	var selectedMonth = period.substring(4, period.length);
	
	var startAndEndDates = {};
	
	startAndEndDates.startDate = selectedYear + '-' + selectedMonth + '-' + '01';
	startAndEndDates.endDate = selectedYear + '-' + selectedMonth + '-' + daysInMonth(parseInt(selectedMonth), parseInt(selectedYear));
	
	return startAndEndDates;
}

// Function to determine the days in selected month
function daysInMonth(m, y) {
    switch (m) {
        case 2 :
            return (y % 4 == 0 && y % 100) || y % 400 == 0 ? 29 : 28;
        case 9 : case 4 : case 6 : case 11 :
            return 30;
        default :
            return 31
    }
}

// Function to determine completeness status for the current month
function getDataSetCompletenessStatus(){

	var sel = dhis2.de.api.getSelections();
	var orgUnit = sel["ou"],
		period = sel["pe"];
	
	var dateParams = getStartAndEndDates(period);

	//"http://localhost:8080/dhis/api/completeDataSetRegistrations.json?dataSet=JxJpNfFEKw7&startDate=2016-08-01&endDate=2016-08-31&orgUnit=y1Zt8YWUdNN"
		
    var params = 
    	'?dataSet=' + 'JxJpNfFEKw7' +
    	'&startDate=' + dateParams.startDate +
    	'&endDate=' + dateParams.endDate + 
    	'&orgUnit=' + orgUnit;
	
	 var completenessPromise = $.get( "../api/completeDataSetRegistrations.json" + params, function(data){});
	
	 return completenessPromise;
}

// Function takes in the uniqueIds and lastPeriods
function getLastMonthAMCVars(lastPeriods){

	var deferredObject = $.Deferred();
	var dataValues = {};
		
	var params = {
		periodId : lastPeriods.lastMonth,
        dataSetId : 'JxJpNfFEKw7',
        organisationUnitId : dhis2.de.getCurrentOrganisationUnit(),
        multiOrganisationUnit: dhis2.de.multiOrganisationUnit
    };
	
	$.ajax( {
    	url: 'getDataValues.action',
    	data: params,
	    dataType: 'json',
	    error: function() // offline
	    {

	    },
	    success: function( json ) // online
	    {
			deferredObject.resolve(json);
        },
        complete: function()
        {

        }
	} );
	return deferredObject.promise(); 
}



// Function takes in the inputs jquery object and returns a javascript object containing UIDs for the SH, SHL, QR, TO, AMC
function determineUniqueIDs($inps, rowIdx){
		
		var uniqueUIDs = {};
		
		$inps.each(function(idx){
			if(rowIdx > 0){
				if(idx == 0){//SH
					uniqueUIDs.SH = $(this).attr('id');
				}else if(idx == 4){//QR
					uniqueUIDs.QR = $(this).attr('id');			
				}else if(idx == 5){//SHL
					uniqueUIDs.SHL = $(this).attr('id');			
				}else if(idx == 7){//TO
					uniqueUIDs.TO = $(this).attr('id');			
				}else if(idx == 8){//AMC
					uniqueUIDs.AMC = $(this).attr('id');				
				}else {
					// nothing
				}
			}
			//console.log('THE INPUTS AT INDEX ' + idx + ' ARE ' + $(this).attr('id'));
		});
		
		
		return uniqueUIDs;
}

// Function to determine the last three periods
function determineLastThreePeriods(){
	// Get the current period
    var sel = dhis2.de.api.getSelections();
	
	// Apply a substring or split function to get month, year
	var selectedYear = sel["pe"].substring(0, 4);
	var selectedMonth = sel["pe"].substring(4, sel["pe"].length);
		
	// parse the month result to an integer
	var intYear = parseInt(selectedYear),
	    intMonth = parseInt(selectedMonth),
		lastMonth = intMonth - 1,
		last2Months = intMonth - 2;
		
	// Check boundaries for years
	var lastMonthPeriod = "",
	    last2MonthsPeriod = "";
	
	if(lastMonth < 10){
		if(lastMonth > 0){
			lastMonthPeriod = selectedYear + '0' + lastMonth;
		}
	}else{
		lastMonthPeriod = selectedYear + '' + lastMonth;
	}
	
	if(last2Months < 10){
		if(last2Months > 0){	
			last2MonthsPeriod = selectedYear + '0' + last2Months;
		}
	}else{
		last2MonthsPeriod = selectedYear + '' + last2Months;
	}
	
	if(lastMonth == 0){
		// Its December previous year
		var resultYear = parseInt(selectedYear) - 1;
		lastMonthPeriod = resultYear + '' + '12';
	}else if(last2Months == 0){
		// Its December previous year
		var resultYear = parseInt(selectedYear) - 1;
		last2MonthsPeriod = resultYear + '' + '12';
	}

    if(parseInt(last2Months) < parseInt(0)){
		// Its November previous year
		var resultYear = parseInt(selectedYear) - 1;
		last2MonthsPeriod = resultYear + '' + '11';
	}
	
	return {
		currentPeriod: sel["pe"],
		lastMonth: lastMonthPeriod,
		last2Months: last2MonthsPeriod
	}
}

// Function to display laboratory tab certain products (404 - 492) in Laboratory tab only when Hospital AHF ART Clinic and Queen II HC is selected
function hideProducts(){
	//get selected orgUnit
	var sel = dhis2.de.api.getSelections();
	var orgUnit = sel["ou"];
	$.get("../api/organisationUnits/"+orgUnit+".json?fields=name", function ( ou ){
        if (ou.name.indexOf("HOSP")>=0 || ou.name.indexOf("Queen Elizabeth II HC") >= 0 || ou.name.indexOf("AHF ART Clinic") >= 0 || 
            ou.name.indexOf("National Reference Clinical Chemistry Laboratory") >= 0 || 
            ou.name.indexOf("National Reference Haematology Laboratory") >= 0 || 
            ou.name.indexOf("National Reference TB Laboratory") >= 0 ||
            ou.name.indexOf("National Reference Microbiology Laboratory") >= 0 ||
            ou.name.indexOf("National Reference Cytology Laboratory") >= 0 ||
            ou.name.indexOf("National Reference Histology Laboratory") >= 0 ||
            ou.name.indexOf("National Reference Molecular Laboratory") >= 0 
                    
                    ) 
          {
            // hospital, so do nothing           
        }
        else {
            // not hospital, so hide products 404 - 492
                    $("#laboratory tbody tr").each(function(i) {
                        var title = $(this).children().eq(4).children().eq(1).text();
                        if ($.type(title) === "undefined"){
                            //skip
                        }
                        else {
                            var productId = parseInt(title.substring(11, 14))
                            if (productId>=404 && productId<=492){
                                $(this).hide();
                            }
                                        
                        }
                    }
                 );
        }
	})
}
