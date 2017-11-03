import { BrowserModule } from '@angular/platform-browser';
import {Component, Inject, Injectable, NgModule, Optional} from '@angular/core';
import {APP_BASE_HREF, Location, LocationStrategy, PathLocationStrategy, PlatformLocation} from '@angular/common';

import {setAngularLib, UpgradeModule} from '@angular/upgrade/static';
import * as angular from 'angular';
import 'angular-route';
import {
  ActivatedRoute, CanActivate, DefaultUrlSerializer, NavigationError, Router, RouterModule,
  UrlSegment, UrlSegmentGroup, UrlSerializer, UrlTree
} from '@angular/router';
import 'rxjs/add/operator/map';
import {Observable} from 'rxjs/Observable';
import {setUpLocationSync} from '@angular/router/upgrade';
import 'rxjs/add/operator/filter';

// ANGULAR JS APP
// ------------------
// ------------------
const angularJsApp = angular.module('legacy', ['ngRoute']);
angularJsApp.config(($locationProvider, $routeProvider) => {
  $locationProvider.html5Mode(true);
  $routeProvider.when('/a/ng1', {template: `
    ANGULARJS RENDERED a/ng1
    <div>
      <a href="/a/ng2">ANGULAR A</a>
      <a href="/b/ng2">ANGULAR B</a>
      <a href="/a/ng1">ANGULARJS A</a>
      <a href="/b/ng1">ANGULARJS B</a>
    </div>
  `});
  $routeProvider.when('/b/ng1', {template: `
    ANGULARJS RENDERED b/ng1
    <div>
      <a href="/a/ng2">ANGULAR A</a>
      <a href="/b/ng2">ANGULAR B</a>
      <a href="/a/ng1">ANGULARJS A</a>
      <a href="/b/ng1">ANGULARJS B</a>
    </div>
  `});
  $routeProvider.otherwise({template: ''}); // <---- NOTE THIS GUY
});



// ANGULAR APP
// ------------------
// ------------------
@Component({
  selector: 'app-root',
  template: `
    <h1>APP</h1>
    <router-outlet></router-outlet>
    <div ng-view></div>
  `
})
export class AppComponent {
}


@Component({
  selector: 'app-angular-cmp',
  template: `ANGULAR RENDERED {{url | async}}
    <div>
      <a routerLink="/a/ng2">ANGULAR A</a>
      <a routerLink="/b/ng2">ANGULAR B</a>
      <a routerLink="/a/ng1">ANGULARJS A</a>
      <a routerLink="/b/ng1">ANGULARJS B</a>
      <a [routerLink]="['/a/ng2', {param: 'a/b/c'}]">/a/ng2;param=a/b/c</a>
    </div>
  `
})
export class RoutableAngularComponent {
  url: Observable<string> = this.route.url.map(p => p.map(s => s.path).join('/'));

  constructor(private route: ActivatedRoute) {
    console.log('route params contain slashes', route.snapshot.params);
  }
}

@Component({
  selector: 'app-empty-cmp',
  template: ``
})
export class EmptyComponent {
}

export function ng1Matcher(url: UrlSegment[]) {
  if (url.length > 1 && url[1].path === 'ng1') {
    return {consumed: url}; // if we consume everything, the URL will match.
  } else {
    return {consumed: []}; // if we don't consume anything, the router will keep matching.
  }
}

/**
 * There is a bug in the AngularJS router that prevents us from matrix parameters
 * having /. The proper fix is to fix the AngularJS router, but it might take some time.
 *
 * This is a temporary workaround:
 *
 * * it replaces an escaped slash (%2F) with a __SLASH__
 * * and then replaced it back.
 *
 * So the URL will say http://localhost:4200/a/ng2;param=a__SLASH__b__SLASH__c
 * but the component will receive: {param: 'a/b/c'}
 */
export class UrlSerializerWithAWorkaroundForAngularJSBug extends DefaultUrlSerializer {
  parse(str: string): UrlTree {
    const url = document.createElement('a');
    url.href = str;
    let res = url.pathname.replace(new RegExp('__SLASH__', 'g'), '%2F');
    if (url.search) {
      res += '?' + url.search;
    }
    if (url.hash) {
      res += '#' + url.hash;
    }
    return super.parse(res);
  }

  serialize(tree: UrlTree): string {
    const str = super.serialize(tree);
    const url = document.createElement('a');
    url.href = str;
    let res = url.pathname.replace(new RegExp('%2F', 'g'), '__SLASH__');
    if (url.search) {
      res += '?' + url.search;
    }
    if (url.hash) {
      res += '#' + url.hash;
    }
    return res;
  }
}

@NgModule({
  declarations: [
    AppComponent,
    RoutableAngularComponent,
    EmptyComponent
  ],
  imports: [
    BrowserModule,
    UpgradeModule,
    RouterModule.forRoot([
      {path: '', component: RoutableAngularComponent},
      {path: 'a/ng2', component: RoutableAngularComponent},
      {path: 'b/ng2', component: RoutableAngularComponent},
      /**
       * Note you can use the '**' instead of a matcher. The '**' route is more forgiving, so everything that
       * works with the matcher, will work with '**' as well.
       *
       * What will be different is that if you have an incorrect URL, that neither AngularJS nor Angular can handle,
       * you will not see any exceptions.
       *
       * If you still want to use the '**' route, you can do a check inside EmptyComponent, something like this:
       *
       * class EmptyComponent {
       *  constructor(route: ActivatedRoute, route: Router) {
       *    route.url.subscribe(url => {
       *      if (// some check about the url goes here) {
       *        console.error('Unknown url');
       *        route.navigateByUrl('/');
       *      }
       *    });
       *  }
       * }
       *
       */
      // {path: '**', component: EmptyComponent}
      {matcher: ng1Matcher, component: EmptyComponent}
    ], { enableTracing: false })
  ],
  providers: [
    {provide: UrlSerializer, useClass: UrlSerializerWithAWorkaroundForAngularJSBug}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(upgrade: UpgradeModule, router: Router) {
    setTimeout(() => {
      setAngularLib(angular);
      upgrade.bootstrap(document.body, ['legacy']);
      setUpLocationSync(upgrade);
    });
  }
}

