<?php
/**
 * Form object for shop search.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 09.23.2013
 * @package shop_search
 */
class ShopSearchForm extends Form
{
	/** @var bool - setting this to true will remove the category dropdwon from the form */
	private static $disable_category_dropdown = false;

	/** @var string - this probably ought to be overridden with a vfi or solr facet unless you're products are only in one category */
	private static $category_field = 'f[ParentID]';

	/** @var string - setting to 'NONE' will mean the category dropdwon will have no empty option */
	private static $category_empty_string = 'All Products';


	/**
	 * @param Controller $controller
	 * @param String     $method
	 * @param string     $suggestURL
	 */
	function __construct($controller, $method, $suggestURL = '') {
		$searchField = new TextField('q', '');
		$searchField->setAttribute('placeholder', _t('ShopSearch.SEARCH', 'Search'));
		if ($suggestURL) $searchField->setAttribute('data-suggest-url', $suggestURL);

		$fields = new FieldList($searchField);
		if (!Config::inst()->get('ShopSearchForm', 'disable_category_dropdown')) {
			$cats     = ShopSearch::get_category_hierarchy();
			$catField = new DropdownField(self::get_category_field(), '', $cats);

			$emptyString = Config::inst()->get('ShopSearchForm', 'category_empty_string');
			if ($emptyString !== 'NONE') {
				$catField->setEmptyString(_t('ShopSearch.'.$emptyString, $emptyString));
			}

			$fields->push($catField);
		}

		parent::__construct($controller, $method, $fields, new FieldList(array(FormAction::create('results', _t('ShopSearch.GO', 'Go')))));

		$this->setFormMethod('GET');
		$this->disableSecurityToken();

		Requirements::css(SHOP_SEARCH_FOLDER . '/css/ShopSearch.css');

		if (Config::inst()->get('ShopSearch', 'suggest_enabled')) {
			Requirements::javascript(THIRDPARTY_DIR . '/jquery-ui/jquery-ui.js');
			Requirements::css(THIRDPARTY_DIR . '/jquery-ui-themes/smoothness/jquery-ui.css');
			Requirements::javascript(SHOP_SEARCH_FOLDER . '/javascript/ShopSearch.js');
		}
	}


	/**
	 * @return string
	 */
	public static function get_category_field() {
		return Config::inst()->get('ShopSearchForm', 'category_field');
	}
}