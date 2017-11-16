import { BrowserModule } from '@angular/platform-browser';
import {Component, Inject, Injectable, NgModule, Optional} from '@angular/core';
import {APP_BASE_HREF, Location, LocationStrategy, PathLocationStrategy, PlatformLocation} from '@angular/common';

import {setAngularLib, UpgradeModule} from '@angular/upgrade/static';
import * as angular from 'angular';
import 'angular-route';
import {ActivatedRoute, CanActivate, NavigationError, Router, RouterModule, UrlSegment} from '@angular/router';
import 'rxjs/add/operator/map';
import {Observable} from 'rxjs/Observable';
import {setUpLocationSync} from '@angular/router/upgrade';
import 'rxjs/add/operator/filter';
import {init} from 'protractor/built/launcher';

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
    </div>
  `
})
export class RoutableAngularComponent {
  url: Observable<string> = this.route.url.map(p => p.map(s => s.path).join('/'));

  constructor(private route: ActivatedRoute) {}
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
 * An example of something that causes an error
 */
export class Throws {
  canActivate() {
    throw new Error('some error');
  }
}

/**
 * We can show some info here or render a fresh button
 */
@Component({
  template: `Some Error`
})
export class ErrorComponent {
  constructor(route: ActivatedRoute, location: Location) {
    (location as ModifiedLocation).goWithoutNotyfingRouter(route.snapshot.queryParams['targetUrl']);
  }
}

@Injectable()
export class ModifiedLocation extends Location {
  skip: boolean = false;

  constructor(strategy: LocationStrategy) {
    super(strategy);
  }

  subscribe(
    onNext: (value: any) => void, onThrow?: ((exception: any) => void)|null,
    onReturn?: (() => void)|null): Object {
    return super.subscribe((value) => {
      // don't tell the router about this ULR change to break the vicious cycle!
      // the router should provide a better way to deal with, but it doesn't
      if (! this.skip) {
        onNext(value);
      }
      this.skip = false;
    }, onThrow, onReturn);
  }

  // set skip = true and then call replaceState
  goWithoutNotyfingRouter(path: string, query: string = ''): void {
    this.skip = true;
    this.go(path, query);
  }
}

@NgModule({
  declarations: [
    AppComponent,
    RoutableAngularComponent,
    EmptyComponent,
    ErrorComponent
  ],
  imports: [
    BrowserModule,
    UpgradeModule,
    RouterModule.forRoot([
      {path: '', component: RoutableAngularComponent},
      {path: 'a/ng2', component: RoutableAngularComponent},
      {path: 'b/ng2', component: RoutableAngularComponent, canActivate: [Throws]},
      {path: 'error', component: ErrorComponent},
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
    ], { enableTracing: true })
  ],
  providers: [Throws, {provide: Location, useClass: ModifiedLocation}],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(upgrade: UpgradeModule, router: Router, location: Location) {
    /**
     * The issue is because of the following two properties of the router:
     * * the router always starts with an empty state and an empty URL
     * * the router rolls back the URL to the latest stable on error
     *
     * If the first navigation fails, the router will reset the URL to the latest stable, which is /.
     *
     * This by itself may not be that problematic: you can replace the URL after. In you case, however,
     * AngularJS picks it up and redirects to a different URL, which results in an error.
     *
     * The workaround is to set the initial URL to the location one.
     *
     * I think a proper fix would be to make the behavior of resetting the url to the latest stable
     * customizable.
     *
     *
     * I put a setTimeout into the subscribe below, so you can see that the url in the browser doesn't
     * change before the "redirect".
     *
     * If you comment out the next three lines, it will change to / first and then will change to /error.
     */
    const initUrlTree = router.parseUrl(location.path());
    (<any>router).currentUrlTree = initUrlTree;
    (<any>router).rawUrlTree = initUrlTree;

    setTimeout(() => {
      setAngularLib(angular);
      upgrade.bootstrap(document.body, ['legacy']);
      const url = document.createElement('a');

      // the following bit is important as well
      upgrade.$injector.get('$rootScope')
        .$on('$locationChangeStart', (_: any, next: string, __: string) => {
          url.href = next;
          if (! (location as ModifiedLocation).skip) {
            router.navigateByUrl(url.pathname + url.search + url.hash);
          }
        });
    });

    // listen to all the errors and navigate to a special /error route
    router.events.filter(e => e instanceof NavigationError).subscribe((e: NavigationError) => {
      setTimeout(() => {
        router.navigate(['/error'], {queryParams: {targetUrl: e.url}, skipLocationChange: true});
      }, 5000);
    });
  }
}

