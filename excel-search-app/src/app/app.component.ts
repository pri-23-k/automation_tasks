// app.component.ts
import { Component } from '@angular/core';
import { ExcelService } from './excel.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  servicenowService = new ExcelService();
  sqlService = new ExcelService();
  userChoice: number = 1; // 1 = Asset Tag, 2 = Serial Number
  userInput: string = '';
  results: string[] = [];

  // Called when file is selected
  async onFileChange(event: any, type: 'servicenow' | 'sql') {
    const file = event.target.files[0];
    if (file) {
      if (type === 'servicenow') {
        await this.servicenowService.parseFile(file);
      } else {
        await this.sqlService.parseFile(file);
      }
    }
  }

  // Called when search type (radio button) changes
  onChoiceChange() {
    this.userInput = '';
    this.results = [];
  }

  printInfoAllSheets(c: number, key: string, sheetsDict: any): string[] {
    key = key.replace(/ /g, '');
    for (const sheet in sheetsDict) {
      const df = sheetsDict[sheet];
      for (const row of df) {
        if (c === 1 && row['Asset tag'] && row['Asset tag'].replace(/ /g, '') === key) {
          return this.formatRow(row, sheet, [
            'Serial number', 'Asset tag', 'Employee number', 'State', 'Substate', 'Code', 'Model category', 'Subcategory', 'Asset Age'
          ]);
        } else if (c === 2 && row['Serial number'] && row['Serial number'].replace(/ /g, '') === key) {
          return this.formatRow(row, sheet, [
            'Serial number', 'Asset tag', 'Employee number', 'State', 'Substate', 'Code', 'Model category', 'Subcategory', 'Asset Age'
          ]);
        }
      }
    }
    return [`No matching record found for key: ${key}`];
  }

  printInfo(c: number, key: string, sheetsDict: any): string[] {
    key = key.replace(/ /g, '');
    for (const sheet in sheetsDict) {
      const df = sheetsDict[sheet];
      for (const row of df) {
        if (c === 1 && row['Asset_Tag'] && row['Asset_Tag'].replace(/ /g, '') === key) {
          return this.formatRow(row, sheet, [
            'Asset_Tag', 'Assigned_To', 'Cost_Center', 'Expenditure_Type', 'Serial_Number', 'State', 'Model_Category'
          ]);
        } else if (c === 2 && row['Serial_Number'] && row['Serial_Number'].replace(/ /g, '') === key) {
          return this.formatRow(row, sheet, [
            'Asset_Tag', 'Assigned_To', 'Cost_Center', 'Expenditure_Type', 'Serial_Number', 'State', 'Model_Category'
          ]);
        }
      }
    }
    return [`No matching record found for key: ${key}`];
  }

  formatRow(row: any, sheet: string, cols: string[]): string[] {
    const output = [`Found in ${sheet}`];
    cols.forEach(col => {
      let val = row[col] ?? '';
      output.push(`${col}: ${val}`);
    });
    return output;
  }

  search() {
    this.results = [
      'Information from Service Now:',
      ...this.printInfoAllSheets(this.userChoice, this.userInput, this.servicenowService.sheetsDict),
      'Information from SQL:',
      ...this.printInfo(this.userChoice, this.userInput, this.sqlService.sheetsDict)
    ];
  }
}
