/**
 * Javascript for autocomplete/suggest/search-as-you-type.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 10.18.13
 * @package shop_search
 * @subpackage javascript
 */
(function ($, window, document, undefined) {
	'use strict';
	if (typeof window.ShopSearch == 'undefined') window.ShopSearch = {};

	/**
	 * TODO: internationalize this
	 * @param priceIn
	 * @returns string
	 */
	function formatCurrency(priceIn) {
		priceIn = parseFloat(priceIn);
		return isNaN(priceIn) ? '$0.00' : '$'+priceIn.toFixed(2);
	}

	window.ShopSearch.Suggest = {
		Config:{
			solrURL:            document.location.protocol + "//" + document.location.host + ':8983/solr/ShopSearchSolr/select',
			filterShowInSearch: true,
			categoryFilter:     'Product_AllCategoryIDsRecursive',
			keywordFilterRegex: /[^a-zA-Z0-9\s\-]/
		},

		/**
		 * Maps a search result from solr to an easy-to-consume format for the renderer
		 * @param prodIn {Object}
		 * @return {Object}
 		 */
		productMappingFunction:function(prodIn){
			var prod = {
				category:   'Products',
				link:       prodIn.Product_Link,
				title:      prodIn.SiteTree_Title,
				thumb:      prodIn.Product_ThumbURL,
				price:      formatCurrency(prodIn.Product_VFI_Price),
			};

			if (prodIn.Product_VFI_Price != prodIn.Product_BasePrice) {
				prod.original_price = formatCurrency(prodIn.Product_BasePrice);
			}

			return prod;
		},

		/**
		 * Renders a list item from data
		 * @param ul {jQuery} - parent
		 * @param item {Object} - data
		 * @return {jQuery} - li node
		 */
		renderMenuItem:function(ul, item) {
			var li = $('<li>');

			if (item.title) {
				var a = $('<a>').addClass('product').attr('href', item.link);

				if (item.thumb) {
					$('<img>').attr('src', item.thumb).appendTo(a);
					a.addClass('thumb');
				}

				$('<span>').addClass('title').html(item.title).appendTo(a);

				if (item.desc) $('<span>').addClass('desc').html(item.desc).appendTo(a);
				if (item.price && item.price != '$0.00') {
					var price = $('<span>').addClass('price').html(item.price).appendTo(a);
					if (item.original_price) price.prepend('<del>'+item.original_price+'</del> ');
				}

				a.appendTo(li);
			} else {
				$('<a>').html(item.label).appendTo(li);
			}

			return li.appendTo(ul);
		},


		/**
		 * @param ul
		 * @param items
		 */
		renderMenu:function( ul, items ) {
			var self = this,
				currentCategory = "";

			ul.addClass('shop-search');
			$.each( items, function( index, item ) {
				if ( item.category != currentCategory ) {
					ul.append( "<li class='ui-autocomplete-category'>" + item.category + "</li>" );
					currentCategory = item.category;
				}
				self._renderItemData( ul, item );
			});
		},


		/**
		 * Initializes the search field
		 */
		init:function(){
			var searchField = $('#ShopSearchForm_SearchForm_q'),
				suggestURL  = ShopSearch.Suggest.Config.solrURL
					+ '?facet=true&sort=score+desc&start=0&facet.limit=5&json.nl=map&facet.field=_autocomplete'
					+ '&wt=json&fq=%2B(_versionedstage:"Live"+(*:*+-_versionedstage:[*+TO+*]))&rows=5',
				cache       = {};

			if (suggestURL && searchField.length > 0) {
				searchField.autocomplete({
					minLength:  2,
					source:function(request, response){
						//console.log('request', request);
						var cacheKey;
						var term = request.term.replace(ShopSearch.Suggest.Config.keywordFilterRegex, '');
						var select = searchField.closest('form').find('select');
						if (select.length > 0) {
							request[select.attr('name')] = select.val();
							cacheKey = 'CAT' + select.val() + '_' + term;
						} else {
							cacheKey = 'CAT0_' + term;
						}

						// Need to factor category in if present
						if (cacheKey in cache) {
							response(cache[cacheKey]);
							return;
						}

						// Format the search terms for solr
						var terms    = term.toLowerCase().split(/\s+/);
						var lastTerm = terms.length > 0 ? terms.pop() : '';
						var prefix   = terms.length > 0 ? terms.join(' ')+' ' : '';

						// we want any complete words to be required and any incomplete words
						// not to be required so if you type "green lolly" we want a query
						// string like "+green lolly lolly*"
						for (var i = 0; i < terms.length; i++) terms[i] = '+' + terms[i];
						terms.push(lastTerm);
						terms.push(lastTerm+'*'); // this allows for partial words to still match

						// build query into url
						var url = suggestURL + '&q=' + encodeURIComponent(terms.join(' '))
							+ '&facet.prefix=' + encodeURIComponent(lastTerm);

						if (ShopSearch.Suggest.Config.filterShowInSearch) {
							url += '&fq=SiteTree_ShowInSearch:1';
						}

						// add category filter if present (NOTE: this is very specific to my configuration right now
						// I will add a better way to configure this in the future.
						if (select.val()) {
							url += '&fq=' + ShopSearch.Suggest.Config.categoryFilter + ':' + select.val();
						}

						// Make the call
						$.ajax({
							url:        url,
							//data:       request,
							dataType:   'jsonp',
							jsonp:      'json.wrf',
							success:function(data, status, xhr) {
								// Result comes back with 2 arrays, transform them into something we can render more easily
								// This is slightly more cumbersome, but it allows the frontend dev to use a different
								// autocomplete (or whatever) javascript.
								var out = [];
								var suggestions = data.facet_counts.facet_fields._autocomplete;
								var products = data.response.docs;

								for (var k in suggestions) {
									out.push({
										label:      prefix + k,
										category:   'Search Suggestions'
									});
								}

								if (products.length > 0) {
									for (var i = 0; i < products.length; i++) {
										out.push(ShopSearch.Suggest.productMappingFunction(products[i]));
									}
								}

								cache[cacheKey] = out;
								response(out);
							}
						});
					}
				});

				// customize rendering
				searchField.data( "ui-autocomplete" )._renderMenu = ShopSearch.Suggest.renderMenu;
				searchField.data( "ui-autocomplete" )._renderItem = ShopSearch.Suggest.renderMenuItem;
			} else {
				console.warn('Unable to initalize search field because suggestURL is empty or there is no field.');
			}
		}
	};

}(jQuery, this, this.document));
