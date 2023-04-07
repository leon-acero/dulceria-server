const regresaMes = (mes) => {
  
  switch (mes) {
    case 1: 
      return "Ene"
    case 2: 
      return "Feb"
    case 3: 
      return "Mar"
    case 4: 
      return "Abr"
    case 5: 
      return "May"
    case 6: 
      return "Jun"
    case 7: 
      return "Jul"
    case 8: 
      return "Ago"
    case 9: 
      return "Sep"
    case 10: 
      return "Oct"
    case 11: 
      return "Nov"
    case 12: 
      return "Dic"
    default:
      return ""
  }
}

exports.module = regresaMes;